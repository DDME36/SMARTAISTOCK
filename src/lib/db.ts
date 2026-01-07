import { createClient } from '@libsql/client'

// Turso database client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN
})

export default db

// Initialize database tables
export async function initDatabase() {
  await db.batch([
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // User watchlist
    `CREATE TABLE IF NOT EXISTS user_watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, symbol)
    )`,
    
    // User settings
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      language TEXT DEFAULT 'en',
      notifications_enabled INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    
    // Shared market data cache (ข้อมูลกลางแชร์ให้ทุก user)
    `CREATE TABLE IF NOT EXISTS market_data_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_type TEXT NOT NULL,
      data_key TEXT NOT NULL,
      data_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      UNIQUE(data_type, data_key)
    )`,
    
    // SMC data cache per symbol
    `CREATE TABLE IF NOT EXISTS smc_cache (
      symbol TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Market sentiment cache (shared)
    `CREATE TABLE IF NOT EXISTS sentiment_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Create indexes
    `CREATE INDEX IF NOT EXISTS idx_watchlist_user ON user_watchlist(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_watchlist_symbol ON user_watchlist(symbol)`,
    `CREATE INDEX IF NOT EXISTS idx_market_cache_type ON market_data_cache(data_type)`
  ])
}

// User operations
export async function createUser(username: string, passwordHash: string) {
  const result = await db.execute({
    sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    args: [username, passwordHash]
  })
  return result.lastInsertRowid
}

export async function getUserByUsername(username: string) {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: [username]
  })
  return result.rows[0] || null
}

export async function getUserById(id: number) {
  const result = await db.execute({
    sql: 'SELECT id, username, created_at FROM users WHERE id = ?',
    args: [id]
  })
  return result.rows[0] || null
}

// Watchlist operations
export async function getUserWatchlist(userId: number): Promise<string[]> {
  const result = await db.execute({
    sql: 'SELECT symbol FROM user_watchlist WHERE user_id = ? ORDER BY added_at',
    args: [userId]
  })
  return result.rows.map(row => row.symbol as string)
}

export async function addToWatchlist(userId: number, symbol: string) {
  await db.execute({
    sql: 'INSERT OR IGNORE INTO user_watchlist (user_id, symbol) VALUES (?, ?)',
    args: [userId, symbol.toUpperCase()]
  })
}

export async function removeFromWatchlist(userId: number, symbol: string) {
  await db.execute({
    sql: 'DELETE FROM user_watchlist WHERE user_id = ? AND symbol = ?',
    args: [userId, symbol.toUpperCase()]
  })
}

// Settings operations
export async function getUserSettings(userId: number) {
  const result = await db.execute({
    sql: 'SELECT * FROM user_settings WHERE user_id = ?',
    args: [userId]
  })
  if (result.rows[0]) return result.rows[0]
  
  // Create default settings
  await db.execute({
    sql: 'INSERT INTO user_settings (user_id) VALUES (?)',
    args: [userId]
  })
  return { user_id: userId, language: 'en', notifications_enabled: 1 }
}

export async function updateUserSettings(userId: number, settings: { language?: string; notifications_enabled?: boolean }) {
  const updates: string[] = []
  const args: (string | number)[] = []
  
  if (settings.language) {
    updates.push('language = ?')
    args.push(settings.language)
  }
  if (settings.notifications_enabled !== undefined) {
    updates.push('notifications_enabled = ?')
    args.push(settings.notifications_enabled ? 1 : 0)
  }
  
  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    args.push(userId)
    await db.execute({
      sql: `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`,
      args
    })
  }
}

// Cache operations (shared data)
export async function getCachedSMC(symbol: string) {
  const result = await db.execute({
    sql: 'SELECT data_json, updated_at FROM smc_cache WHERE symbol = ?',
    args: [symbol]
  })
  if (!result.rows[0]) return null
  
  const row = result.rows[0]
  return {
    data: JSON.parse(row.data_json as string),
    updatedAt: row.updated_at
  }
}

export async function setCachedSMC(symbol: string, data: object) {
  await db.execute({
    sql: `INSERT OR REPLACE INTO smc_cache (symbol, data_json, updated_at) 
          VALUES (?, ?, CURRENT_TIMESTAMP)`,
    args: [symbol, JSON.stringify(data)]
  })
}

export async function getCachedSentiment() {
  const result = await db.execute({
    sql: 'SELECT data_json, updated_at FROM sentiment_cache WHERE id = 1'
  })
  if (!result.rows[0]) return null
  
  const row = result.rows[0]
  return {
    data: JSON.parse(row.data_json as string),
    updatedAt: row.updated_at
  }
}

export async function setCachedSentiment(data: object) {
  await db.execute({
    sql: `INSERT OR REPLACE INTO sentiment_cache (id, data_json, updated_at) 
          VALUES (1, ?, CURRENT_TIMESTAMP)`,
    args: [JSON.stringify(data)]
  })
}

// Get all unique symbols from all users' watchlists (for batch processing)
export async function getAllWatchedSymbols(): Promise<string[]> {
  const result = await db.execute({
    sql: 'SELECT DISTINCT symbol FROM user_watchlist'
  })
  return result.rows.map(row => row.symbol as string)
}
