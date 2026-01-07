import { Language } from '@/types'

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    pro_terminal: "Pro Terminal",
    refresh: "Refresh",
    alerts: "Alerts",
    
    // Cards
    ai_market_sense: "AI Market Sense",
    market_sentiment: "Market Sentiment",
    add_symbol: "Add Symbol",
    add_to_watchlist: "Add to Watchlist",
    active_watchlist: "Active Watchlist",
    recent_signals: "Recent Signals",
    nearest_targets: "Nearest Targets",
    quick_stats: "Quick Stats",
    
    // Navigation
    full_watchlist: "Full Watchlist",
    alert_history: "Alert History",
    settings: "Settings",
    
    // Market Status
    market_open: "Market Open",
    market_closed: "Market Closed",
    data_delayed: "Data Delayed",
    last_update: "Last update",
    minutes_ago: "m ago",
    
    // Stats
    buy: "Buy",
    sell: "Sell",
    near: "Near",
    bull: "Bull",
    add_stocks_stats: "Add stocks to see stats",
    add_stocks_targets: "Add stocks to see price targets",
    away: "away",
    
    // Sentiment Analysis
    extreme_fear_opportunity: "Extreme Fear = Opportunity",
    bullish_momentum: "Bullish Momentum Building",
    market_consolidation: "Market in Consolidation",
    caution_risk: "Caution: Risk Elevated",
    high_risk: "High Risk Environment",
    dca_quality: "DCA into quality stocks",
    follow_trend: "Follow the trend",
    wait_confirmation: "Wait for confirmation",
    reduce_exposure: "Reduce exposure",
    stay_cash: "Stay in cash",
    yield_warning: "Yield Curve Inverted — Recession Warning",
    
    // Watchlist
    assets: "Assets",
    empty_watchlist: "Empty watchlist",
    smc_analyzed: "SMC",
    live_price: "Live",
    smc_tag: "SMC",
    live_tag: "Live",
    bullish: "Bullish",
    bearish: "Bearish",
    neutral_trend: "Neutral",
    price_loading: "Loading price...",
    price_unavailable: "Price unavailable",
    loading_prices: "Loading prices",
    retry_in: "Retry in",
    seconds: "s",
    last_smc_update: "SMC Updated",
    next_update: "Next update",
    market_hours: "Market hours",
    after_hours: "After hours",
    
    // Loading States
    loading: "Loading...",
    checking: "Checking...",
    verifying: "Verifying symbol...",
    refreshing: "Refreshing...",
    
    // Actions
    added: "Added",
    removed: "Removed",
    updated: "Updated!",
    
    // Errors
    already_in_list: "Already in watchlist",
    please_enter_symbol: "Please enter a symbol",
    invalid_symbol: "Invalid Symbol",
    symbol_not_found: "Symbol not found",
    try_symbols: "Try: AAPL, TSLA, NVDA, GOOGL, BTC-USD, ETH-USD",
    add_hint: "Add stocks like AAPL, TSLA or crypto like BTC-USD",
    error_refresh: "Error refreshing data",
    
    // Export
    copied: "Copied JSON to clipboard!",
    copy_prompt: "Copy this JSON:",
    export_watchlist: "Export Watchlist",
    
    // Settings
    language: "Language",
    choose_language: "Choose your preferred language",
    push_notifications: "Push Notifications",
    get_alerts_ob: "Get alerts when stocks enter Order Blocks",
    notifications_enabled: "Notifications Enabled",
    notifications_blocked: "Notifications Blocked",
    enable_notifications: "Enable Notifications",
    browser_settings_hint: "Go to browser settings to enable notifications",
    data_management: "Data Management",
    export_clear_data: "Export or clear your data",
    refresh_data: "Refresh Data",
    clear_all_data: "Clear All Data",
    clearing: "Clearing...",
    confirm_clear: "Clear all data? (Watchlist, Settings)",
    cleared_data: "Cleared all data",
    data_refreshed: "Data refreshed!",
    failed_refresh: "Failed to refresh",
    version: "Version",
    
    // Alert Messages
    alert_bullish_bos: "Bullish BOS: Price broke above",
    alert_bearish_bos: "Bearish BOS: Price broke below",
    alert_premium_zone: "Price in Premium Zone - Look for sells",
    alert_discount_zone: "Price in Discount Zone - Look for buys",
    alert_fvg_buy: "FVG BUY at",
    alert_fvg_sell: "FVG SELL at",
    alert_away: "away",
    
    // Misc
    out_of_100: "out of 100",
    waiting: "WAITING",
    no_signals: "No signals yet",
    app_subtitle: "Smart Money Concept • Next.js PWA",
    loading_market_data: "Loading market data...",
    back_online: "Back online",
    no_connection: "No connection",
    no_smc_data: "No SMC Analysis Data",
    no_smc_data_desc: "Showing live prices. Run backend for full SMC analysis.",
    last_update_label: "Last update",
    install_app: "Install SMC Alert",
    install_desc: "Add to home screen for quick access & notifications",
    not_now: "Not now",
    install: "Install",
    
    // Alerts Page
    buy_signals: "Buy Signals",
    sell_signals: "Sell Signals",
    all: "All",
    no_alerts_yet: "No alerts yet",
    add_stocks_alerts: "Add stocks to your watchlist to see alerts",
    
    // Watchlist Page
    search_symbols: "Search symbols...",
    stocks: "stocks",
    of: "of",
    no_watchlist: "No watchlist",
    add_stocks_dashboard: "Add stocks from the dashboard",
    
    // Auth
    "auth.subtitle": "Smart Money Concept Analysis",
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.username": "Username",
    "auth.usernamePlaceholder": "Enter username",
    "auth.password": "Password",
    "auth.passwordPlaceholder": "Enter password",
    "auth.confirmPassword": "Confirm Password",
    "auth.confirmPasswordPlaceholder": "Enter password again",
    "auth.passwordMismatch": "Passwords do not match",
    "auth.loginButton": "Sign In",
    "auth.registerButton": "Create Account",
    "auth.noAccount": "Don't have an account? ",
    "auth.hasAccount": "Already have an account? ",
    "auth.logout": "Logout",
    "auth.welcome": "Welcome",
    
    // Confirm Dialog
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    confirm_delete_symbol: "Remove from watchlist?",
    confirm_delete_symbol_desc: "This will remove the stock from your watchlist.",
    confirm_clear_title: "Clear All Data?",
    confirm_clear_desc: "This will delete your watchlist, settings, and all cached data. This action cannot be undone.",
    confirm_logout_title: "Logout?",
    confirm_logout_desc: "You will need to login again to access your account."
  },
  th: {
    // Header
    pro_terminal: "เทอร์มินัลโปร",
    refresh: "รีเฟรช",
    alerts: "แจ้งเตือน",
    
    // Cards
    ai_market_sense: "AI วิเคราะห์ตลาด",
    market_sentiment: "อารมณ์ตลาด",
    add_symbol: "เพิ่มหุ้น",
    add_to_watchlist: "เพิ่มเข้าลิสต์",
    active_watchlist: "รายการติดตาม",
    recent_signals: "สัญญาณล่าสุด",
    nearest_targets: "เป้าหมายใกล้สุด",
    quick_stats: "สถิติด่วน",
    
    // Navigation
    full_watchlist: "รายการหุ้นทั้งหมด",
    alert_history: "ประวัติแจ้งเตือน",
    settings: "ตั้งค่า",
    
    // Market Status
    market_open: "ตลาดเปิด",
    market_closed: "ตลาดปิด",
    data_delayed: "ข้อมูลล่าช้า",
    last_update: "อัพเดทล่าสุด",
    minutes_ago: "นาทีที่แล้ว",
    
    // Stats
    buy: "ซื้อ",
    sell: "ขาย",
    near: "ใกล้",
    bull: "ขาขึ้น",
    add_stocks_stats: "เพิ่มหุ้นเพื่อดูสถิติ",
    add_stocks_targets: "เพิ่มหุ้นเพื่อดูเป้าหมายราคา",
    away: "ห่าง",
    
    // Sentiment Analysis
    extreme_fear_opportunity: "ความกลัวสุดขีด = โอกาส",
    bullish_momentum: "โมเมนตัมขาขึ้นกำลังก่อตัว",
    market_consolidation: "ตลาดพักตัว",
    caution_risk: "ระวัง: ความเสี่ยงสูงขึ้น",
    high_risk: "สภาพแวดล้อมเสี่ยงสูง",
    dca_quality: "DCA หุ้นคุณภาพ",
    follow_trend: "ตามเทรนด์",
    wait_confirmation: "รอสัญญาณยืนยัน",
    reduce_exposure: "ลดความเสี่ยง",
    stay_cash: "ถือเงินสด",
    yield_warning: "Yield Curve กลับหัว — สัญญาณเตือนถดถอย",
    
    // Watchlist
    assets: "รายการ",
    empty_watchlist: "ไม่มีรายการหุ้น",
    smc_analyzed: "SMC",
    live_price: "Live",
    smc_tag: "วิเคราะห์",
    live_tag: "ราคาสด",
    bullish: "ขาขึ้น",
    bearish: "ขาลง",
    neutral_trend: "ทรงตัว",
    price_loading: "กำลังโหลดราคา...",
    price_unavailable: "ไม่พบราคา",
    loading_prices: "กำลังโหลดราคา",
    retry_in: "ลองใหม่ใน",
    seconds: "วิ",
    last_smc_update: "SMC อัพเดท",
    next_update: "รอบถัดไป",
    market_hours: "ตลาดเปิด",
    after_hours: "ตลาดปิด",
    
    // Loading States
    loading: "กำลังโหลด...",
    checking: "กำลังตรวจสอบ...",
    verifying: "กำลังยืนยันชื่อหุ้น...",
    refreshing: "กำลังรีเฟรช...",
    
    // Actions
    added: "เพิ่มแล้ว",
    removed: "ลบแล้ว",
    updated: "อัพเดทแล้ว!",
    
    // Errors
    already_in_list: "มีในรายการแล้ว",
    please_enter_symbol: "กรุณาระบุชื่อหุ้น",
    invalid_symbol: "ไม่พบชื่อหุ้นนี้",
    symbol_not_found: "ไม่พบหุ้น",
    try_symbols: "ลอง: AAPL, TSLA, NVDA, GOOGL, BTC-USD, ETH-USD",
    add_hint: "เพิ่มหุ้นเช่น AAPL, TSLA หรือคริปโต BTC-USD",
    error_refresh: "รีเฟรชข้อมูลไม่สำเร็จ",
    
    // Export
    copied: "คัดลอก JSON แล้ว!",
    copy_prompt: "คัดลอกโค้ดนี้:",
    export_watchlist: "ส่งออกรายการ",
    
    // Settings
    language: "ภาษา / Language",
    choose_language: "เลือกภาษาที่ต้องการ",
    push_notifications: "การแจ้งเตือน",
    get_alerts_ob: "รับแจ้งเตือนเมื่อหุ้นเข้า Order Block",
    notifications_enabled: "เปิดการแจ้งเตือนแล้ว",
    notifications_blocked: "การแจ้งเตือนถูกบล็อก",
    enable_notifications: "เปิดการแจ้งเตือน",
    browser_settings_hint: "ไปที่ตั้งค่าเบราว์เซอร์เพื่อเปิดการแจ้งเตือน",
    data_management: "จัดการข้อมูล",
    export_clear_data: "ส่งออกหรือล้างข้อมูล",
    refresh_data: "รีเฟรชข้อมูล",
    clear_all_data: "ล้างข้อมูลทั้งหมด",
    clearing: "กำลังล้าง...",
    confirm_clear: "ล้างข้อมูลทั้งหมด? (รายการหุ้น, ตั้งค่า)",
    cleared_data: "ล้างข้อมูลแล้ว",
    data_refreshed: "รีเฟรชข้อมูลแล้ว!",
    failed_refresh: "รีเฟรชไม่สำเร็จ",
    version: "เวอร์ชัน",
    
    // Alert Messages
    alert_bullish_bos: "ขาขึ้น BOS: ราคาทะลุขึ้นเหนือ",
    alert_bearish_bos: "ขาลง BOS: ราคาทะลุลงต่ำกว่า",
    alert_premium_zone: "ราคาอยู่ในโซน Premium - มองหาจุดขาย",
    alert_discount_zone: "ราคาอยู่ในโซน Discount - มองหาจุดซื้อ",
    alert_fvg_buy: "FVG ซื้อ ที่",
    alert_fvg_sell: "FVG ขาย ที่",
    alert_away: "ห่าง",
    
    // Misc
    out_of_100: "คะแนนเต็ม 100",
    waiting: "กำลังรอ",
    no_signals: "ยังไม่มีสัญญาณ",
    app_subtitle: "Smart Money Concept • Next.js PWA",
    loading_market_data: "กำลังโหลดข้อมูลตลาด...",
    back_online: "กลับมาออนไลน์แล้ว",
    no_connection: "ไม่มีการเชื่อมต่อ",
    no_smc_data: "ยังไม่มีข้อมูล SMC Analysis",
    no_smc_data_desc: "แสดงราคาสด รัน backend เพื่อวิเคราะห์ SMC เต็มรูปแบบ",
    last_update_label: "อัพเดทล่าสุด",
    install_app: "ติดตั้ง SMC Alert",
    install_desc: "เพิ่มไปหน้าจอหลักเพื่อเข้าถึงเร็วขึ้นและรับการแจ้งเตือน",
    not_now: "ไว้ก่อน",
    install: "ติดตั้ง",
    
    // Alerts Page
    buy_signals: "สัญญาณซื้อ",
    sell_signals: "สัญญาณขาย",
    all: "ทั้งหมด",
    no_alerts_yet: "ยังไม่มีการแจ้งเตือน",
    add_stocks_alerts: "เพิ่มหุ้นเข้ารายการติดตามเพื่อดูการแจ้งเตือน",
    
    // Watchlist Page
    search_symbols: "ค้นหาหุ้น...",
    stocks: "หุ้น",
    of: "จาก",
    no_watchlist: "ไม่มีรายการหุ้น",
    add_stocks_dashboard: "เพิ่มหุ้นจากหน้าหลัก",
    
    // Auth
    "auth.subtitle": "วิเคราะห์ Smart Money Concept",
    "auth.login": "เข้าสู่ระบบ",
    "auth.register": "สมัครสมาชิก",
    "auth.username": "ชื่อผู้ใช้",
    "auth.usernamePlaceholder": "ใส่ชื่อผู้ใช้",
    "auth.password": "รหัสผ่าน",
    "auth.passwordPlaceholder": "ใส่รหัสผ่าน",
    "auth.confirmPassword": "ยืนยันรหัสผ่าน",
    "auth.confirmPasswordPlaceholder": "ใส่รหัสผ่านอีกครั้ง",
    "auth.passwordMismatch": "รหัสผ่านไม่ตรงกัน",
    "auth.loginButton": "เข้าสู่ระบบ",
    "auth.registerButton": "สร้างบัญชี",
    "auth.noAccount": "ยังไม่มีบัญชี? ",
    "auth.hasAccount": "มีบัญชีแล้ว? ",
    "auth.logout": "ออกจากระบบ",
    "auth.welcome": "ยินดีต้อนรับ",
    
    // Confirm Dialog
    cancel: "ยกเลิก",
    confirm: "ยืนยัน",
    delete: "ลบ",
    confirm_delete_symbol: "ลบออกจากรายการ?",
    confirm_delete_symbol_desc: "หุ้นนี้จะถูกลบออกจากรายการติดตามของคุณ",
    confirm_clear_title: "ล้างข้อมูลทั้งหมด?",
    confirm_clear_desc: "การดำเนินการนี้จะลบรายการหุ้น, การตั้งค่า และข้อมูลแคชทั้งหมด ไม่สามารถกู้คืนได้",
    confirm_logout_title: "ออกจากระบบ?",
    confirm_logout_desc: "คุณจะต้องเข้าสู่ระบบอีกครั้งเพื่อเข้าถึงบัญชีของคุณ"
  }
}
