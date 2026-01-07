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
    """Load watchlist from various sources"""
    watchlist = []
    interval = '1h'
    
    # Priority: Next.js public > backend data > environment
    paths = [
        '../public/data/watchlist.json',
        'data/watchlist.json'
    ]
    
    for path in paths:
        try:
            with open(path, 'r') as f:
                data = json.load(f)
                watchlist = data.get('symbols', [])
                interval = data.get('interval', '1h')
                if watchlist:
                    print(f"✓ Loaded watchlist from {path}")
                    break
        except:
            continue
    
    if not watchlist:
        wl_env = os.environ.get('WATCHLIST', 'AAPL,TSLA,NVDA,GOOGL,MSFT')
        watchlist = [x.strip().upper() for x in wl_env.split(',')]
        interval = os.environ.get('INTERVAL', '1h')
        print(f"✓ Using environment watchlist")
    
    return watchlist, interval


def analyze_stocks(watchlist: List[str], interval: str, notifier: NotificationSender) -> Dict:
    """Run SMC analysis on all stocks"""
    results = {}
    total_alerts = 0
    
    for symbol in watchlist:
        print(f"\n📈 Analyzing {symbol}...")
        try:
            smc = SMCCalculator(symbol, interval=interval)
            result = smc.analyze()
            
            if result:
                results[symbol] = result
                alerts = result.get('alerts', [])
                
                # Send notifications for high-priority alerts
                for alert in alerts:
                    if alert.get('priority') in ['critical', 'high']:
                        msg = f"🚨 {symbol}: {alert['message']}"
                        print(f"   >> {msg}")
                        notifier.send(msg)
                        total_alerts += 1
                
                # Print summary
                trend = result.get('trend', {})
                trend_dir = trend.get('direction', 'neutral')
                emoji = '🟢' if trend_dir == 'bullish' else '🔴' if trend_dir == 'bearish' else '🟡'
                print(f"   {emoji} {trend_dir.upper()} | OB: {result['ob_summary']['total_buy']}B/{result['ob_summary']['total_sell']}S | Alerts: {len(alerts)}")
                
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
    print("📊 ANALYSIS COMPLETE")
    print("=" * 60)
    print(f"   Stocks Analyzed: {summary['total_stocks']}")
    print(f"   Total Alerts: {summary['total_alerts']}")
    print(f"   Market Bias: 🟢{summary['market_bias']['bullish']} 🔴{summary['market_bias']['bearish']} 🟡{summary['market_bias']['neutral']}")
    print(f"   Sentiment Score: {summary['sentiment_score']}/100")
    print(f"   Recommendation: {summary['recommendation']}")
    
    if summary['top_buy_opportunities']:
        print("\n   🎯 Top BUY Opportunities:")
        for opp in summary['top_buy_opportunities'][:3]:
            print(f"      • {opp['symbol']}: {opp['message']}")
    
    if summary['top_sell_opportunities']:
        print("\n   ⚠️ Top SELL Signals:")
        for opp in summary['top_sell_opportunities'][:3]:
            print(f"      • {opp['symbol']}: {opp['message']}")
    
    print("=" * 60)


def analyze_all():
    """Main analysis function"""
    print_banner()
    
    # Load watchlist
    watchlist, interval = load_watchlist()
    print(f"\n📋 Watchlist: {', '.join(watchlist)}")
    print(f"⏱️ Interval: {interval}")
    
    # Initialize notifier
    notifier = NotificationSender()
    
    # Run stock analysis
    stocks = analyze_stocks(watchlist, interval, notifier)
    
    # Run sentiment analysis
    sentiment = analyze_sentiment()
    
    # Generate summary
    summary = generate_summary(stocks, sentiment)
    
    # Build output
    output = {
        'generated_at': datetime.now().isoformat(),
        'interval': interval,
        'market_sentiment': sentiment,
        'stocks': stocks,
        'summary': summary
    }
    
    # Save results
    save_results(output)
    
    # Print summary
    print_summary(summary)
    
    return output


if __name__ == "__main__":
    analyze_all()
