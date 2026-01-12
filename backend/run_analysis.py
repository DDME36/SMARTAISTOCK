#!/usr/bin/env python3
"""
SMC Alert Pro - Main Analysis Runner
====================================
Runs complete analysis pipeline:
1. SMC Analysis (Order Blocks, FVG, Structure)
2. Market Sentiment (VIX, Fear & Greed, Breadth)
3. Alert Generation & Notifications

Outputs to both backend/data/ and public/data/ for Next.js
"""

import os
import json
import shutil
from datetime import datetime
from typing import Dict, List

from smc_calculator import SMCCalculator, analyze_watchlist
from market_sentiment import MarketSentimentAnalyzer
from send_notification import NotificationSender


def load_watchlist() -> tuple[List[str], str]:
    """Load watchlist from database API or fallback sources"""
    watchlist = []
    # Changed to Daily timeframe for Position Trading (holding weeks/months)
    # Daily is better for swing/position traders who don't need intraday noise
    interval = os.environ.get('INTERVAL', '1d')
    
    # Try to fetch from database API first
    api_base = os.environ.get('API_BASE_URL', '')
    api_key = os.environ.get('INTERNAL_API_KEY', '')
    
    if api_base and api_key:
        try:
            import requests
            res = requests.get(
                f'{api_base}/api/data/symbols',
                headers={'x-api-key': api_key},
                timeout=10
            )
            if res.ok:
                data = res.json()
                watchlist = data.get('symbols', [])
                if watchlist:
                    print(f"✓ Loaded {len(watchlist)} symbols from database")
                    return watchlist, interval
        except Exception as e:
            print(f"⚠️ Could not fetch from API: {e}")
    
    # Fallback: Try Turso direct connection
    turso_url = os.environ.get('TURSO_DATABASE_URL', '')
    turso_token = os.environ.get('TURSO_AUTH_TOKEN', '')
    
    if turso_url and turso_token:
        try:
            import libsql_experimental as libsql
            conn = libsql.connect(turso_url, auth_token=turso_token)
            result = conn.execute('SELECT DISTINCT symbol FROM user_watchlist').fetchall()
            watchlist = [row[0] for row in result]
            if watchlist:
                print(f"✓ Loaded {len(watchlist)} symbols from Turso DB")
                return watchlist, interval
        except Exception as e:
            print(f"⚠️ Could not connect to Turso: {e}")
    
    # Fallback: Local files
    paths = [
        '../public/data/watchlist.json',
        'data/watchlist.json'
    ]
    
    for path in paths:
        try:
            with open(path, 'r') as f:
                data = json.load(f)
                watchlist = data.get('symbols', [])
                interval = data.get('interval', interval)
                if watchlist:
                    print(f"✓ Loaded watchlist from {path}")
                    return watchlist, interval
        except:
            continue
    
    # Final fallback: Environment variable
    wl_env = os.environ.get('WATCHLIST', '')
    if wl_env:
        watchlist = [x.strip().upper() for x in wl_env.split(',') if x.strip()]
        print(f"✓ Using environment watchlist")
    
    if not watchlist:
        print("⚠️ No watchlist found - using defaults")
        watchlist = ['AAPL', 'TSLA', 'NVDA', 'GOOGL', 'MSFT']
    
    return watchlist, interval


def analyze_stocks(watchlist: List[str], interval: str, notifier: NotificationSender, sentiment: Dict = None) -> Dict:
    """Run SMC analysis on all stocks with market sentiment integration"""
    results = {}
    total_alerts = 0
    
    for symbol in watchlist:
        print(f"\n📈 Analyzing {symbol}...")
        try:
            smc = SMCCalculator(symbol, interval=interval)
            result = smc.analyze()
            
            if result:
                # Update position score with market sentiment
                if sentiment and result.get('position_score'):
                    # Recalculate with sentiment
                    updated_score = smc.calculate_position_score(
                        trend=result.get('trend', {}),
                        zones=result.get('zones', {}),
                        indicators=result.get('indicators', {}),
                        order_blocks=result.get('order_blocks', []),
                        structure=result.get('structure_breaks', {}),
                        market_sentiment=sentiment
                    )
                    result['position_score'] = updated_score
                
                results[symbol] = result
                alerts = result.get('alerts', [])
                
                # Send notifications for high-priority alerts
                for alert in alerts:
                    if alert.get('priority') in ['critical', 'high']:
                        msg = f"🚨 {symbol}: {alert['message']}"
                        print(f"   >> {msg}")
                        notifier.send(msg)
                        total_alerts += 1
                
                # Print summary with position score
                trend = result.get('trend', {})
                trend_dir = trend.get('direction', 'neutral')
                pos_score = result.get('position_score', {})
                score = pos_score.get('score', 50)
                action = pos_score.get('action_th', 'รอดู')
                
                emoji = '🟢' if score >= 60 else '🔴' if score <= 40 else '🟡'
                print(f"   {emoji} Position Score: {score}/100 ({action})")
                print(f"   Trend: {trend_dir.upper()} | OB: {result['ob_summary']['total_buy']}B/{result['ob_summary']['total_sell']}S")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    return results


def analyze_sentiment() -> Dict:
    """Run market sentiment analysis"""
    print("\n🌍 Analyzing Market Sentiment...")
    try:
        analyzer = MarketSentimentAnalyzer()
        result = analyzer.analyze()
        
        score = result.get('score', 50)
        rec = result.get('recommendation', 'HOLD')
        
        emoji = '🟢' if score >= 60 else '🔴' if score < 40 else '🟡'
        print(f"   {emoji} Score: {score}/100 | Recommendation: {rec}")
        
        return result
    except Exception as e:
        print(f"   ❌ Sentiment Error: {e}")
        return {
            'score': 50,
            'recommendation': 'HOLD',
            'message': 'Unable to fetch sentiment data',
            'indicators': {}
        }


def generate_summary(stocks: Dict, sentiment: Dict) -> Dict:
    """Generate analysis summary"""
    total_stocks = len(stocks)
    total_alerts = sum(len(s.get('alerts', [])) for s in stocks.values())
    
    bullish_count = sum(1 for s in stocks.values() if s.get('trend', {}).get('direction') == 'bullish')
    bearish_count = sum(1 for s in stocks.values() if s.get('trend', {}).get('direction') == 'bearish')
    
    # Find best opportunities
    buy_opportunities = []
    sell_opportunities = []
    
    for symbol, data in stocks.items():
        for alert in data.get('alerts', []):
            if alert.get('signal') == 'BUY' and alert.get('priority') in ['critical', 'high']:
                buy_opportunities.append({
                    'symbol': symbol,
                    'message': alert['message'],
                    'distance_pct': alert.get('distance_pct', 0)
                })
            elif alert.get('signal') == 'SELL' and alert.get('priority') in ['critical', 'high']:
                sell_opportunities.append({
                    'symbol': symbol,
                    'message': alert['message'],
                    'distance_pct': alert.get('distance_pct', 0)
                })
    
    # Sort by distance
    buy_opportunities.sort(key=lambda x: x['distance_pct'])
    sell_opportunities.sort(key=lambda x: x['distance_pct'])
    
    return {
        'total_stocks': total_stocks,
        'total_alerts': total_alerts,
        'market_bias': {
            'bullish': bullish_count,
            'bearish': bearish_count,
            'neutral': total_stocks - bullish_count - bearish_count
        },
        'sentiment_score': sentiment.get('score', 50),
        'recommendation': sentiment.get('recommendation', 'HOLD'),
        'top_buy_opportunities': buy_opportunities[:5],
        'top_sell_opportunities': sell_opportunities[:5]
    }


def save_results(output: Dict):
    """Save results to both backend and frontend locations"""
    os.makedirs('data', exist_ok=True)
    
    # Save to backend/data
    backend_path = 'data/smc_data.json'
    with open(backend_path, 'w') as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\n✓ Saved to {backend_path}")
    
    # Sync to Next.js public folder
    nextjs_paths = [
        '../public/data',
        '../../public/data'  # Alternative path
    ]
    
    for nextjs_path in nextjs_paths:
        if os.path.exists(nextjs_path):
            dest = f'{nextjs_path}/smc_data.json'
            shutil.copy(backend_path, dest)
            print(f"✓ Synced to {dest}")
            break


def print_banner():
    """Print startup banner"""
    print("\n" + "=" * 60)
    print("🤖 SMC ALERT PRO - Analysis Runner v2.0")
    print("=" * 60)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)


def print_summary(summary: Dict):
    """Print analysis summary"""
    print("\n" + "=" * 60)
    print("📊 ANALYSIS COMPLETE (Position Trading Mode)")
    print("=" * 60)
    print(f"   Stocks Analyzed: {summary['total_stocks']}")
    print(f"   Total Alerts: {summary['total_alerts']}")
    print(f"   Market Bias: 🟢{summary['market_bias']['bullish']} 🔴{summary['market_bias']['bearish']} 🟡{summary['market_bias']['neutral']}")
    print(f"   Sentiment Score: {summary['sentiment_score']}/100")
    print(f"   Recommendation: {summary['recommendation']}")
    
    # Position Trading Summary
    pos = summary.get('position_trading', {})
    if pos:
        print("\n   📈 POSITION TRADING SIGNALS:")
        
        if pos.get('strong_buy_opportunities'):
            print("\n   🟢 STRONG BUY (จุดเข้าที่ดีมาก):")
            for opp in pos['strong_buy_opportunities'][:3]:
                print(f"      • {opp['symbol']} @ ${opp['price']:.2f} - Score: {opp['score']}/100")
                print(f"        {opp['summary']}")
        
        if pos.get('buy_opportunities'):
            print("\n   🟡 BUY (น่าสนใจ):")
            for opp in pos['buy_opportunities'][:3]:
                print(f"      • {opp['symbol']} @ ${opp['price']:.2f} - Score: {opp['score']}/100")
        
        if pos.get('take_profit_signals'):
            print("\n   🔴 TAKE PROFIT (ควรทำกำไร):")
            for opp in pos['take_profit_signals'][:3]:
                print(f"      • {opp['symbol']} @ ${opp['price']:.2f} - Score: {opp['score']}/100")
                print(f"        {opp['summary']}")
        
        if pos.get('caution_signals'):
            print("\n   🟠 CAUTION (ระวัง):")
            for opp in pos['caution_signals'][:3]:
                print(f"      • {opp['symbol']} @ ${opp['price']:.2f} - Score: {opp['score']}/100")
    
    print("=" * 60)


def analyze_all():
    """Main analysis function"""
    print_banner()
    
    # Load watchlist
    watchlist, interval = load_watchlist()
    print(f"\n📋 Watchlist: {', '.join(watchlist)}")
    print(f"⏱️ Interval: {interval} (Daily for Position Trading)")
    
    # Initialize notifier
    notifier = NotificationSender()
    
    # Run sentiment analysis FIRST (so we can use it in stock analysis)
    sentiment = analyze_sentiment()
    
    # Run stock analysis with sentiment integration
    stocks = analyze_stocks(watchlist, interval, notifier, sentiment)
    
    # Generate summary
    summary = generate_summary(stocks, sentiment)
    
    # Add position trading summary
    summary['position_trading'] = generate_position_summary(stocks)
    
    # Build output
    output = {
        'generated_at': datetime.now().isoformat(),
        'interval': interval,
        'trading_style': 'position',  # NEW: Indicate this is for position trading
        'market_sentiment': sentiment,
        'stocks': stocks,
        'summary': summary
    }
    
    # Save results
    save_results(output)
    
    # Print summary
    print_summary(summary)
    
    return output


def generate_position_summary(stocks: Dict) -> Dict:
    """Generate position trading specific summary"""
    strong_buys = []
    buys = []
    strong_sells = []
    sells = []
    
    for symbol, data in stocks.items():
        pos_score = data.get('position_score', {})
        score = pos_score.get('score', 50)
        action = pos_score.get('action', 'HOLD')
        summary = pos_score.get('summary', '')
        
        entry = {
            'symbol': symbol,
            'score': score,
            'action': action,
            'summary': summary,
            'price': data.get('current_price', 0),
            'zone': data.get('zones', {}).get('current_zone', 'neutral')
        }
        
        if action == 'STRONG_BUY':
            strong_buys.append(entry)
        elif action == 'BUY':
            buys.append(entry)
        elif action == 'STRONG_SELL':
            strong_sells.append(entry)
        elif action == 'SELL':
            sells.append(entry)
    
    # Sort by score
    strong_buys.sort(key=lambda x: x['score'], reverse=True)
    buys.sort(key=lambda x: x['score'], reverse=True)
    strong_sells.sort(key=lambda x: x['score'])
    sells.sort(key=lambda x: x['score'])
    
    return {
        'strong_buy_opportunities': strong_buys,
        'buy_opportunities': buys,
        'take_profit_signals': strong_sells,
        'caution_signals': sells,
        'total_actionable': len(strong_buys) + len(buys) + len(strong_sells) + len(sells)
    }


if __name__ == "__main__":
    analyze_all()
