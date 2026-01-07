import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { createUser, getUserByUsername, getUserById } from './db'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

const COOKIE_NAME = 'blockhunter_token'

export interface UserPayload {
  id: number
  username: string
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Create JWT token
export async function createToken(user: UserPayload): Promise<string> {
  return new SignJWT({ 
    id: user.id, 
    username: user.username
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

// Verify JWT token
export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as UserPayload
  } catch {
    return null
  }
}

// Register new user
export async function register(username: string, password: string) {
  // Validate
  if (!username || !password) {
    return { error: 'Username and password required' }
  }
  if (username.length < 3) {
    return { error: 'Username must be at least 3 characters' }
  }
  if (password.length < 4) {
    return { error: 'Password must be at least 4 characters' }
  }
  
  // Check if user exists
  const existing = await getUserByUsername(username)
  if (existing) {
    return { error: 'Username already taken' }
  }
  
  // Create user
  const passwordHash = await hashPassword(password)
  const userId = await createUser(username, passwordHash)
  
  const user: UserPayload = { 
    id: Number(userId), 
    username
  }
  const token = await createToken(user)
  
  return { user, token }
}

// Login user
export async function login(username: string, password: string) {
  const user = await getUserByUsername(username)
  if (!user) {
    return { error: 'Invalid username or password' }
  }
  
  const valid = await verifyPassword(password, user.password_hash as string)
  if (!valid) {
    return { error: 'Invalid username or password' }
  }
  
  const userPayload: UserPayload = {
    id: user.id as number,
    username: user.username as string
  }
  const token = await createToken(userPayload)
  
  return { user: userPayload, token }
}

// Get current user from cookies (server-side)
export async function getCurrentUser(): Promise<UserPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  
  if (!token) return null
  
  const payload = await verifyToken(token)
  if (!payload) return null
  
  // Verify user still exists
  const user = await getUserById(payload.id)
  if (!user) return null
  
  return {
    id: user.id as number,
    username: user.username as string
  }
}

// Set auth cookie
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })
}

// Clear auth cookie
export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export { COOKIE_NAME }
