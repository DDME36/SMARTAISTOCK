import yfinance as yf

symbols = ['AAPL', 'ACHR', 'EOSE', 'HIMS', 'RDW']
screenshot_prices = {
    'AAPL': 257.16,
    'ACHR': 8.78,
    'EOSE': 14.56,
    'HIMS': 35.49,
    'RDW': 9.98
}

print('=' * 60)
print('LIVE PRICES vs SCREENSHOT COMPARISON')
print('=' * 60)
print(f"{'Symbol':<8} {'Screenshot':<12} {'Live Now':<12} {'Diff':<10}")
print('-' * 60)

for sym in symbols:
    try:
        ticker = yf.Ticker(sym)
        hist = ticker.history(period='2d')
        if not hist.empty:
            live_price = hist['Close'].iloc[-1]
            screenshot = screenshot_prices.get(sym, 0)
            diff = live_price - screenshot
            diff_pct = (diff / screenshot * 100) if screenshot else 0
            print(f'{sym:<8} ${screenshot:<11.2f} ${live_price:<11.2f} {diff:+.2f} ({diff_pct:+.1f}%)')
    except Exception as e:
        print(f'{sym}: Error - {e}')

print('=' * 60)
