# SMC Alert Pro - Next.js Version

Modern Next.js 14 PWA for Smart Money Concept stock alerts. Get push notifications when stocks enter Order Blocks.

## ✨ Features

- 🎨 Beautiful dark UI with time-based themes
- 📱 PWA - Install on mobile/desktop, works offline
- 🔔 Push Notifications when stocks hit Order Blocks
- 👤 Personal watchlist (stored locally per user)
- 🌐 Multi-language (EN/TH)
- ⚡ Auto-updates every 15 minutes during market hours
- 🆓 100% Free hosting (Vercel + GitHub Actions)

## 🚀 Deploy (Free)

### Step 1: Fork & Deploy to Vercel

1. Fork this repo to your GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project" → Import your forked repo
4. Click "Deploy" (no config needed)
5. Done! Your app is live at `https://your-project.vercel.app`

### Step 2: Enable Auto-Analysis

GitHub Actions will automatically analyze stocks every 15 minutes during US market hours.

**Optional: Add notification secrets in GitHub repo settings:**
- `DISCORD_WEBHOOK` - Discord webhook URL
- `TELEGRAM_BOT_TOKEN` - Telegram bot token  
- `TELEGRAM_CHAT_ID` - Telegram chat ID

### Step 3: Install PWA

1. Open your Vercel URL on mobile
2. Tap "Add to Home Screen" (iOS) or "Install" (Android)
3. Enable notifications when prompted
4. Done! You'll get alerts when stocks enter Order Blocks

## 📱 How It Works

```
┌─────────────────┐     ┌──────────────────┐
│   Vercel        │     │  GitHub Actions  │
│   (Frontend)    │     │  (Every 15 min)  │
│   - Next.js PWA │     │  - Python script │
│   - Push Notif  │     │  - Fetch stocks  │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         │    ┌──────────────┐   │
         └───►│ smc_data.json│◄──┘
              │ (in repo)    │
              └──────────────┘
```

**Each user:**
- Has their own watchlist (saved in browser localStorage)
- Gets notifications only for THEIR watchlist stocks
- Can add/remove stocks anytime

## 🛠️ Local Development

```bash
# Install dependencies
npm install
cd backend && pip install -r requirements.txt && cd ..

# Run analysis once
cd backend && python run_analysis.py && cd ..

# Start dev server
npm run dev
```

## 📁 Project Structure

```
stock-alert-nextjs/
├── backend/                 # Python analysis
│   ├── run_analysis.py      # Main script
│   ├── smc_calculator.py    # Order Block detection
│   └── market_sentiment.py  # Fear/Greed analysis
├── public/
│   ├── data/smc_data.json   # Analysis results
│   ├── sw.js                # Service Worker
│   └── manifest.json        # PWA manifest
├── src/
│   ├── app/                 # Next.js pages
│   ├── components/          # React components
│   ├── lib/notifications.ts # Push notification utils
│   └── store/               # Zustand state
└── .github/workflows/       # Auto-analysis
```

## ❓ FAQ

**Q: ทำไมแต่ละคนเห็นหุ้นไม่เหมือนกัน?**
A: Watchlist เก็บใน browser ของแต่ละคน ไม่ได้แชร์กัน

**Q: ถ้าพิมพ์ชื่อหุ้นผิดจะเป็นยังไง?**
A: ระบบจะเช็คกับ Yahoo Finance ถ้าไม่เจอจะแสดง error พร้อมตัวอย่างหุ้นที่ถูกต้อง

**Q: Notification ทำงานยังไง?**
A: เมื่อ GitHub Actions อัพเดทข้อมูล → Vercel deploy ใหม่ → PWA ดึงข้อมูลใหม่ → เช็ค alerts → แจ้งเตือน

**Q: ฟรีจริงไหม?**
A: ฟรี 100%! Vercel free tier + GitHub Actions free tier เพียงพอสำหรับใช้งานปกติ
