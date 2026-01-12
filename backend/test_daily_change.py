import yfinance as yf

symbols = ['EOSE', 'HIMS', 'ACHR', 'RDW', 'IREN']

print('=' * 70)
print('DAILY CHANGE TEST - Using regularMarketChangePercent')
print('=' * 70)
print(f"{'Symbol':<8} {'Price':<10} {'Change $':<10} {'Change %':<10} {'Prev Close':<12}")
print('-' * 70)

for sym in symbols:
    try:
        ticker = yf.Ticker(sym)
        info = ticker.info
        
        price = info.get('regularMarketPrice', 0)
        change_pct = info.get('regularMarketChangePercent', 0)
        change_amt = info.get('regularMarketChange', 0)
        prev_close = info.get('regularMarketPreviousClose', 0)
        
        print(f'{sym:<8} ${price:<9.2f} {change_amt:+.2f}      {change_pct:+.2f}%     ${prev_close:.2f}')
    except Exception as e:
        print(f'{sym}: Error - {e}')

print('=' * 70)
