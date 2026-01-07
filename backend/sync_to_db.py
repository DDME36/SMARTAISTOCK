#!/usr/bin/env python3
"""
Sync SMC data and market sentiment to Turso database.
This script fetches all watched symbols from the database,
calculates SMC data, and updates the cache for all users.
"""

import os
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Configuration
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:3000')
INTERNAL_API_KEY = os.getenv('INTERNAL_API_KEY', '')

def get_watched_symbols():
    """Get all unique symbols from all users' watchlists."""
    try:
        res = requests.get(
            f'{API_BASE_URL}/api/data/symbols',
            headers={'x-api-key': INTERNAL_API_KEY},
            timeout=10
        )
        if res.ok:
            data = res.json()
            return data.get('symbols', [])
    except Exception as e:
        print(f'Error getting symbols: {e}')
    return []

def update_smc_cache(stocks_data: dict):
    """Batch update SMC cache in database."""
    try:
        res = requests.put(
            f'{API_BASE_URL}/api/data/smc',
            headers={
                'x-api-key': INTERNAL_API_KEY,
                'Content-Type': 'application/json'
            },
            json={'stocks': stocks_data},
            timeout=30
        )
        if res.ok:
            data = res.json()
            print(f"Updated {len(data.get('updated', []))} symbols in cache")
            return True
    except Exception as e:
        print(f'Error updating SMC cache: {e}')
    return False

def update_sentiment_cache(sentiment_data: dict):
    """Update market sentiment cache in database."""
    try:
        res = requests.post(
            f'{API_BASE_URL}/api/data/sentiment',
            headers={
                'x-api-key': INTERNAL_API_KEY,
                'Content-Type': 'application/json'
            },
            json={'sentiment': sentiment_data},
            timeout=10
        )
        if res.ok:
            print('Updated sentiment cache')
            return True
    except Exception as e:
        print(f'Error updating sentiment cache: {e}')
    return False

def main():
    print(f'\n=== Sync to Database - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} ===\n')
    
    # Get all watched symbols
    symbols = get_watched_symbols()
    print(f'Found {len(symbols)} unique symbols to process')
    
    if not symbols:
        print('No symbols to process')
        return
    
    # Import SMC calculator
    try:
        from smc_calculator import calculate_smc_for_symbol
        from market_sentiment import get_market_sentiment
    except ImportError:
        print('Error: Could not import smc_calculator or market_sentiment')
        return
    
    # Calculate SMC for each symbol
    stocks_data = {}
    for symbol in symbols:
        print(f'Processing {symbol}...')
        try:
            data = calculate_smc_for_symbol(symbol)
            if data:
                stocks_data[symbol] = data
                print(f'  ✓ {symbol} processed')
            else:
                print(f'  ✗ {symbol} failed')
        except Exception as e:
            print(f'  ✗ {symbol} error: {e}')
    
    # Update SMC cache
    if stocks_data:
        update_smc_cache(stocks_data)
    
    # Get and update market sentiment
    print('\nProcessing market sentiment...')
    try:
        sentiment = get_market_sentiment()
        if sentiment:
            update_sentiment_cache(sentiment)
            print('  ✓ Sentiment processed')
    except Exception as e:
        print(f'  ✗ Sentiment error: {e}')
    
    print(f'\n=== Sync Complete ===\n')

if __name__ == '__main__':
    main()
