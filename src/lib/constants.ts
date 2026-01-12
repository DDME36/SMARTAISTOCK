// ===== APP CONFIGURATION =====

// Cache & Refresh Settings
export const PRICE_CACHE_TTL = 30 * 1000 // 30 seconds
export const PRICE_REFRESH_INTERVAL = 30 * 1000 // 30 seconds
export const SMC_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
export const TOAST_DURATION = 3000 // 3 seconds

// Data Freshness Thresholds
export const DATA_FRESH_THRESHOLD = 20 // minutes - green status
export const DATA_STALE_THRESHOLD = 30 // minutes - warning during market hours

// Market Hours (US Eastern Time)
export const MARKET_OPEN_HOUR = 9
export const MARKET_OPEN_MINUTE = 30
export const MARKET_CLOSE_HOUR = 16
export const MARKET_CLOSE_MINUTE = 0

// Alert Thresholds
export const NEAR_ZONE_THRESHOLD = 3 // % - considered "near" zone
export const QUALITY_SCORE_MIN = 60 // minimum quality for alerts

// API Settings
export const API_TIMEOUT = 10000 // 10 seconds
export const MAX_BATCH_SIZE = 10 // max symbols per batch request

// Validation
export const MIN_PASSWORD_LENGTH = 6
export const MAX_SYMBOL_LENGTH = 10
export const MAX_WATCHLIST_SIZE = 50

// UI Settings
export const ANIMATION_DELAY = 80 // ms between card animations
