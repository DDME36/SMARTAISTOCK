#!/usr/bin/env python3
"""
Test script to check which stocks can fetch data from Yahoo Finance
"""
import yfinance as yf
import json

# Test symbols - common ones + ones from user's watchlist
test_symbols = [
    # User's watchlist (from screenshot)
    "IREN", "HIMS", "ENVX", "PRME", "RBLX", "RKLB", "META", "RDW", "EOSE",
    # Common US stocks
    "AAPL", "TSLA", "NVDA", "GOOGL", "MSFT", "AMZN", "AMD",
    # Crypto
    "BTC-USD", "ETH-USD",
    # Some that might fail
    "INVALID123", "TEST"
]

def test_stock(symbol):
    """Test fetching data for a single stock"""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period="5d")
        
        if hist.empty:
            return {
                "symbol": symbol,
                "status": "NO_DATA",
                "error": "No historical data"
            }
        
        # Get name and other info
        name = info.get('shortName') or info.get('longName') or symbol
        exchange = info.get('exchange', 'Unknown')
        currency = info.get('currency', 'USD')
        price = hist['Close'].iloc[-1] if not hist.empty else None
        
        return {
            "symbol": symbol,
            "status": "OK",
            "name": name,
            "exchange": exchange,
            "currency": currency,
            "price": round(float(price), 2) if price else None,
            "candles": len(hist)
        }
    except Exception as e:
        return {
            "symbol": symbol,
            "status": "ERROR",
            "error": str(e)
        }

def main():
    print("=" * 60)
    print("🔍 Testing Stock Data Fetching from Yahoo Finance")
    print("=" * 60)
    
    results = {
        "success": [],
        "failed": [],
        "no_data": []
    }
    
    for symbol in test_symbols:
        print(f"\nTesting {symbol}...", end=" ")
        result = test_stock(symbol)
        
        if result["status"] == "OK":
            print(f"✅ {result['name']} (${result['price']})")
            results["success"].append(result)
        elif result["status"] == "NO_DATA":
            print(f"⚠️ No data: {result.get('error', 'Unknown')}")
            results["no_data"].append(result)
        else:
            print(f"❌ Error: {result.get('error', 'Unknown')}")
            results["failed"].append(result)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"✅ Success: {len(results['success'])}")
    print(f"⚠️ No Data: {len(results['no_data'])}")
    print(f"❌ Failed: {len(results['failed'])}")
    
    if results["success"]:
        print("\n✅ Successful stocks:")
        for r in results["success"]:
            print(f"   {r['symbol']}: {r['name']} - ${r['price']} ({r['exchange']})")
    
    if results["no_data"]:
        print("\n⚠️ Stocks with no data:")
        for r in results["no_data"]:
            print(f"   {r['symbol']}: {r.get('error', 'No data')}")
    
    if results["failed"]:
        print("\n❌ Failed stocks:")
        for r in results["failed"]:
            print(f"   {r['symbol']}: {r.get('error', 'Unknown error')}")
    
    # Save results
    with open('data/stock_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    print("\n✅ Results saved to data/stock_test_results.json")

if __name__ == "__main__":
    main()
