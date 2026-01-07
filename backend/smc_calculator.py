"""
SMC Calculator - Professional Grade Smart Money Concepts Analysis
=================================================================
Features:
- Order Blocks (OB) - Swing & Internal
- Fair Value Gaps (FVG) - Imbalance zones
- Break of Structure (BOS) - Trend continuation
- Change of Character (CHoCH) - Trend reversal signals
- Liquidity Zones - Equal highs/lows, stop hunts
- Premium/Discount Zones - Fibonacci-based
- Multi-timeframe analysis support
- Smart caching to reduce API calls

Author: SMC Alert Pro
Version: 2.0
"""

import json
import os
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from functools import lru_cache
import pandas as pd
import numpy as np

# ==================== Data Providers ====================

class DataCache:
    """Simple file-based cache for API responses"""
    def __init__(self, cache_dir='data/cache', ttl_minutes=15):
        self.cache_dir = cache_dir
        self.ttl = timedelta(minutes=ttl_minutes)
        os.makedirs(cache_dir, exist_ok=True)
    
    def _get_key(self, symbol: str, interval: str) -> str:
        return hashlib.md5(f"{symbol}_{interval}".encode()).hexdigest()
    
    def get(self, symbol: str, interval: str) -> Optional[pd.DataFrame]:
        key = self._get_key(symbol, interval)
        path = f"{self.cache_dir}/{key}.json"
        try:
            if os.path.exists(path):
                mtime = datetime.fromtimestamp(os.path.getmtime(path))
                if datetime.now() - mtime < self.ttl:
                    with open(path, 'r') as f:
                        data = json.load(f)
                    return pd.DataFrame(data)
        except:
            pass
        return None
    
    def set(self, symbol: str, interval: str, df: pd.DataFrame):
        key = self._get_key(symbol, interval)
        path = f"{self.cache_dir}/{key}.json"
        try:
            df_copy = df.copy()
            if 'Date' in df_copy.columns:
                df_copy['Date'] = df_copy['Date'].astype(str)
            df_copy.to_json(path, orient='records')
        except:
            pass


class YFinanceProvider:
    """Primary data provider using yfinance"""
    def fetch(self, symbol: str, interval: str, period: str) -> Optional[pd.DataFrame]:
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            
            # Try multiple periods if data is sparse
            for p in [period, '3mo', '6mo', '1y']:
                df = ticker.history(period=p, interval=interval)
                if not df.empty and len(df) >= 50:
                    break
            
            if df.empty:
                return None
            
            df = df.reset_index()
            if 'Datetime' in df.columns:
                df = df.rename(columns={'Datetime': 'Date'})
            
            # Ensure required columns
            required = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
            if not all(col in df.columns for col in required):
                return None
            
            return df[required]
        except Exception as e:
            print(f'  [yfinance] Error: {e}')
            return None


class AlphaVantageProvider:
    """Backup provider using Alpha Vantage API"""
    def __init__(self):
        self.api_key = os.environ.get('ALPHA_VANTAGE_KEY', '')
    
    def fetch(self, symbol: str, interval: str, period: str) -> Optional[pd.DataFrame]:
        if not self.api_key:
            return None
        try:
            import requests
            av_interval = '60min' if interval == '1h' else 'daily'
            func = 'TIME_SERIES_DAILY' if av_interval == 'daily' else 'TIME_SERIES_INTRADAY'
            
            url = f'https://www.alphavantage.co/query?function={func}&symbol={symbol}&interval={av_interval}&apikey={self.api_key}&outputsize=full'
            key = 'Time Series (Daily)' if av_interval == 'daily' else f'Time Series ({av_interval})'
            
            data = requests.get(url, timeout=15).json()
            if key not in data:
                return None
            
            rows = []
            for d, v in data[key].items():
                rows.append({
                    'Date': pd.to_datetime(d),
                    'Open': float(v['1. open']),
                    'High': float(v['2. high']),
                    'Low': float(v['3. low']),
                    'Close': float(v['4. close']),
                    'Volume': int(v['5. volume'])
                })
            
            return pd.DataFrame(rows).sort_values('Date').reset_index(drop=True)
        except Exception as e:
            print(f'  [AlphaVantage] Error: {e}')
            return None


class DataFetcher:
    """Unified data fetcher with caching and fallback"""
    def __init__(self):
        self.cache = DataCache()
        self.providers = [
            ('yfinance', YFinanceProvider()),
            ('AlphaVantage', AlphaVantageProvider())
        ]
    
    def fetch(self, symbol: str, interval: str = '1h', period: str = '1mo') -> Tuple[Optional[pd.DataFrame], Optional[str]]:
        # Check cache first
        cached = self.cache.get(symbol, interval)
        if cached is not None and len(cached) >= 50:
            print(f'  [CACHE] Using cached data for {symbol}')
            return cached, 'cache'
        
        # Try providers
        for name, provider in self.providers:
            df = provider.fetch(symbol, interval, period)
            if df is not None and not df.empty and len(df) >= 20:
                print(f'  [OK] {name} - {len(df)} candles')
                self.cache.set(symbol, interval, df)
                return df, name
        
        return None, None


# ==================== SMC Analysis Engine ====================

class SMCCalculator:
    """
    Professional Smart Money Concepts Calculator
    
    Analyzes price action to identify:
    - Order Blocks (institutional supply/demand)
    - Fair Value Gaps (imbalances)
    - Break of Structure (trend continuation)
    - Change of Character (trend reversal)
    - Liquidity zones (stop hunts)
    """
    
    def __init__(self, symbol: str, interval: str = '1h', period: str = '1mo'):
        self.symbol = symbol.upper()
        self.interval = interval
        self.period = period
        self.df: Optional[pd.DataFrame] = None
        self.data_source: Optional[str] = None
        self.fetcher = DataFetcher()
    
    def fetch_data(self) -> bool:
        """Fetch price data from providers"""
        self.df, self.data_source = self.fetcher.fetch(self.symbol, self.interval, self.period)
        return self.df is not None and len(self.df) >= 20
    
    # ==================== Swing Points ====================
    
    def find_swing_points(self, length: int = 5) -> Tuple[List[Dict], List[Dict]]:
        """
        Find swing highs and lows using fractal method
        A swing high/low is confirmed when surrounded by lower highs/higher lows
        """
        highs = self.df['High'].values
        lows = self.df['Low'].values
        n = len(highs)
        
        swing_highs, swing_lows = [], []
        
        for i in range(length, n - length):
            # Swing High: highest point in window
            window_highs = highs[i - length:i + length + 1]
            if highs[i] == max(window_highs):
                swing_highs.append({
                    'index': i,
                    'price': float(highs[i]),
                    'date': str(self.df['Date'].iloc[i])
                })
            
            # Swing Low: lowest point in window
            window_lows = lows[i - length:i + length + 1]
            if lows[i] == min(window_lows):
                swing_lows.append({
                    'index': i,
                    'price': float(lows[i]),
                    'date': str(self.df['Date'].iloc[i])
                })
        
        return swing_highs, swing_lows
    
    # ==================== Trend Detection ====================
    
    def detect_trend(self, swing_highs: List[Dict], swing_lows: List[Dict]) -> Dict:
        """
        Detect market structure and trend
        - Higher Highs + Higher Lows = Bullish
        - Lower Highs + Lower Lows = Bearish
        """
        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return {'direction': 'neutral', 'strength': 0, 'structure': 'undefined'}
        
        # Get last 4 swing points
        recent_highs = swing_highs[-4:] if len(swing_highs) >= 4 else swing_highs
        recent_lows = swing_lows[-4:] if len(swing_lows) >= 4 else swing_lows
        
        # Check for Higher Highs / Lower Highs
        hh_count = sum(1 for i in range(1, len(recent_highs)) 
                       if recent_highs[i]['price'] > recent_highs[i-1]['price'])
        lh_count = sum(1 for i in range(1, len(recent_highs)) 
                       if recent_highs[i]['price'] < recent_highs[i-1]['price'])
        
        # Check for Higher Lows / Lower Lows
        hl_count = sum(1 for i in range(1, len(recent_lows)) 
                       if recent_lows[i]['price'] > recent_lows[i-1]['price'])
        ll_count = sum(1 for i in range(1, len(recent_lows)) 
                       if recent_lows[i]['price'] < recent_lows[i-1]['price'])
        
        # Determine trend
        bullish_score = hh_count + hl_count
        bearish_score = lh_count + ll_count
        
        if bullish_score > bearish_score + 1:
            direction = 'bullish'
            structure = 'HH-HL'
        elif bearish_score > bullish_score + 1:
            direction = 'bearish'
            structure = 'LH-LL'
        else:
            direction = 'neutral'
            structure = 'ranging'
        
        strength = abs(bullish_score - bearish_score) / max(bullish_score + bearish_score, 1)
        
        return {
            'direction': direction,
            'strength': round(strength, 2),
            'structure': structure,
            'hh_count': hh_count,
            'hl_count': hl_count,
            'lh_count': lh_count,
            'll_count': ll_count
        }

    
    # ==================== Order Blocks ====================
    
    def find_order_blocks(self, swing_highs: List[Dict], swing_lows: List[Dict], 
                          max_blocks: int = 10) -> List[Dict]:
        """
        Find Order Blocks - institutional supply/demand zones
        
        Bullish OB: Last bearish candle before a strong bullish move
        Bearish OB: Last bullish candle before a strong bearish move
        """
        if self.df is None or len(self.df) < 20:
            return []
        
        obs = []
        opens = self.df['Open'].values
        highs = self.df['High'].values
        lows = self.df['Low'].values
        closes = self.df['Close'].values
        price = closes[-1]
        
        # Find Bearish Order Blocks (supply zones)
        for sh in swing_highs:
            idx = sh['index']
            if idx <= 5 or idx >= len(closes) - 1:
                continue
            
            # Look for the last bullish candle before the swing high
            for j in range(idx - 1, max(0, idx - 10), -1):
                if closes[j] > opens[j]:  # Bullish candle
                    h, l = float(highs[j]), float(lows[j])
                    mid = (h + l) / 2
                    
                    # Check if OB is still valid (not mitigated)
                    mitigated = any(closes[k] > h for k in range(j + 1, len(closes)))
                    
                    if not mitigated:
                        distance = abs(price - mid)
                        obs.append({
                            'type': 'bearish',
                            'signal': 'SELL',
                            'high': round(h, 2),
                            'low': round(l, 2),
                            'mid': round(mid, 2),
                            'distance': round(distance, 2),
                            'distance_pct': round(distance / price * 100, 2),
                            'strength': self._calc_ob_strength(j, idx, 'bearish'),
                            'date': str(self.df['Date'].iloc[j]),
                            'mitigated': False
                        })
                    break
        
        # Find Bullish Order Blocks (demand zones)
        for sl in swing_lows:
            idx = sl['index']
            if idx <= 5 or idx >= len(closes) - 1:
                continue
            
            # Look for the last bearish candle before the swing low
            for j in range(idx - 1, max(0, idx - 10), -1):
                if closes[j] < opens[j]:  # Bearish candle
                    h, l = float(highs[j]), float(lows[j])
                    mid = (h + l) / 2
                    
                    # Check if OB is still valid (not mitigated)
                    mitigated = any(closes[k] < l for k in range(j + 1, len(closes)))
                    
                    if not mitigated:
                        distance = abs(price - mid)
                        obs.append({
                            'type': 'bullish',
                            'signal': 'BUY',
                            'high': round(h, 2),
                            'low': round(l, 2),
                            'mid': round(mid, 2),
                            'distance': round(distance, 2),
                            'distance_pct': round(distance / price * 100, 2),
                            'strength': self._calc_ob_strength(j, idx, 'bullish'),
                            'date': str(self.df['Date'].iloc[j]),
                            'mitigated': False
                        })
                    break
        
        # Sort by distance and add rank
        obs.sort(key=lambda x: x['distance'])
        for i, ob in enumerate(obs):
            ob['rank'] = i + 1
        
        return obs[:max_blocks]
    
    def _calc_ob_strength(self, ob_idx: int, swing_idx: int, ob_type: str) -> str:
        """Calculate Order Block strength based on the move after it"""
        if self.df is None:
            return 'weak'
        
        closes = self.df['Close'].values
        
        # Calculate the move from OB to swing point
        if ob_type == 'bullish':
            move = (closes[swing_idx] - closes[ob_idx]) / closes[ob_idx] * 100
        else:
            move = (closes[ob_idx] - closes[swing_idx]) / closes[ob_idx] * 100
        
        if move > 5:
            return 'strong'
        elif move > 2:
            return 'moderate'
        else:
            return 'weak'

    
    # ==================== Fair Value Gaps (FVG) ====================
    
    def find_fair_value_gaps(self, min_gap_pct: float = 0.1) -> List[Dict]:
        """
        Find Fair Value Gaps (Imbalances)
        
        Bullish FVG: Gap between candle 1's high and candle 3's low (in uptrend)
        Bearish FVG: Gap between candle 1's low and candle 3's high (in downtrend)
        """
        if self.df is None or len(self.df) < 10:
            return []
        
        fvgs = []
        highs = self.df['High'].values
        lows = self.df['Low'].values
        closes = self.df['Close'].values
        price = closes[-1]
        
        for i in range(2, len(self.df) - 1):
            # Bullish FVG: candle 3's low > candle 1's high
            if lows[i] > highs[i - 2]:
                gap_size = lows[i] - highs[i - 2]
                gap_pct = gap_size / highs[i - 2] * 100
                
                if gap_pct >= min_gap_pct:
                    mid = (lows[i] + highs[i - 2]) / 2
                    
                    # Check if FVG is filled
                    filled = any(lows[j] <= highs[i - 2] for j in range(i + 1, len(lows)))
                    
                    if not filled:
                        fvgs.append({
                            'type': 'bullish',
                            'signal': 'BUY',
                            'high': round(float(lows[i]), 2),
                            'low': round(float(highs[i - 2]), 2),
                            'mid': round(mid, 2),
                            'gap_pct': round(gap_pct, 2),
                            'distance': round(abs(price - mid), 2),
                            'distance_pct': round(abs(price - mid) / price * 100, 2),
                            'date': str(self.df['Date'].iloc[i]),
                            'filled': False
                        })
            
            # Bearish FVG: candle 3's high < candle 1's low
            if highs[i] < lows[i - 2]:
                gap_size = lows[i - 2] - highs[i]
                gap_pct = gap_size / lows[i - 2] * 100
                
                if gap_pct >= min_gap_pct:
                    mid = (highs[i] + lows[i - 2]) / 2
                    
                    # Check if FVG is filled
                    filled = any(highs[j] >= lows[i - 2] for j in range(i + 1, len(highs)))
                    
                    if not filled:
                        fvgs.append({
                            'type': 'bearish',
                            'signal': 'SELL',
                            'high': round(float(lows[i - 2]), 2),
                            'low': round(float(highs[i]), 2),
                            'mid': round(mid, 2),
                            'gap_pct': round(gap_pct, 2),
                            'distance': round(abs(price - mid), 2),
                            'distance_pct': round(abs(price - mid) / price * 100, 2),
                            'date': str(self.df['Date'].iloc[i]),
                            'filled': False
                        })
        
        # Sort by distance
        fvgs.sort(key=lambda x: x['distance'])
        return fvgs[:10]
    
    # ==================== Break of Structure (BOS) & CHoCH ====================
    
    def detect_structure_breaks(self, swing_highs: List[Dict], swing_lows: List[Dict]) -> Dict:
        """
        Detect Break of Structure (BOS) and Change of Character (CHoCH)
        
        BOS: Price breaks a swing point in the direction of the trend (continuation)
        CHoCH: Price breaks a swing point against the trend (reversal signal)
        """
        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return {'bos': [], 'choch': None}
        
        closes = self.df['Close'].values
        price = closes[-1]
        
        bos_list = []
        choch = None
        
        # Get recent swing points
        recent_high = swing_highs[-1]
        recent_low = swing_lows[-1]
        prev_high = swing_highs[-2] if len(swing_highs) >= 2 else None
        prev_low = swing_lows[-2] if len(swing_lows) >= 2 else None
        
        # Check for bullish BOS (price breaks above recent swing high)
        if price > recent_high['price']:
            bos_list.append({
                'type': 'bullish',
                'level': recent_high['price'],
                'broken_at': round(price, 2),
                'signal': 'BUY',
                'message': f"Bullish BOS: Price broke above {recent_high['price']:.2f}"
            })
        
        # Check for bearish BOS (price breaks below recent swing low)
        if price < recent_low['price']:
            bos_list.append({
                'type': 'bearish',
                'level': recent_low['price'],
                'broken_at': round(price, 2),
                'signal': 'SELL',
                'message': f"Bearish BOS: Price broke below {recent_low['price']:.2f}"
            })
        
        # Check for CHoCH (Change of Character)
        # Bullish CHoCH: In downtrend, price breaks above a lower high
        if prev_high and recent_high['price'] < prev_high['price']:  # Lower high pattern
            if price > recent_high['price']:
                choch = {
                    'type': 'bullish',
                    'level': recent_high['price'],
                    'signal': 'BUY',
                    'message': 'Bullish CHoCH: Potential trend reversal to upside'
                }
        
        # Bearish CHoCH: In uptrend, price breaks below a higher low
        if prev_low and recent_low['price'] > prev_low['price']:  # Higher low pattern
            if price < recent_low['price']:
                choch = {
                    'type': 'bearish',
                    'level': recent_low['price'],
                    'signal': 'SELL',
                    'message': 'Bearish CHoCH: Potential trend reversal to downside'
                }
        
        return {'bos': bos_list, 'choch': choch}

    
    # ==================== Liquidity Zones ====================
    
    def find_liquidity_zones(self, swing_highs: List[Dict], swing_lows: List[Dict], 
                             tolerance: float = 0.005) -> Dict:
        """
        Find Liquidity Zones - areas where stop losses cluster
        
        - Equal Highs (EQH): Multiple swing highs at similar levels
        - Equal Lows (EQL): Multiple swing lows at similar levels
        - These are targets for liquidity sweeps
        """
        eqh = []  # Equal Highs
        eql = []  # Equal Lows
        
        price = self.df['Close'].iloc[-1]
        
        # Find Equal Highs
        for i, sh1 in enumerate(swing_highs):
            for sh2 in swing_highs[i + 1:]:
                diff_pct = abs(sh1['price'] - sh2['price']) / sh1['price']
                if diff_pct <= tolerance:
                    level = (sh1['price'] + sh2['price']) / 2
                    # Check if not already added
                    if not any(abs(e['level'] - level) / level < tolerance for e in eqh):
                        eqh.append({
                            'level': round(level, 2),
                            'type': 'resistance',
                            'signal': 'SELL',
                            'distance_pct': round(abs(price - level) / price * 100, 2),
                            'liquidity': 'high',
                            'message': f'Equal Highs at ${level:.2f} - Liquidity above'
                        })
        
        # Find Equal Lows
        for i, sl1 in enumerate(swing_lows):
            for sl2 in swing_lows[i + 1:]:
                diff_pct = abs(sl1['price'] - sl2['price']) / sl1['price']
                if diff_pct <= tolerance:
                    level = (sl1['price'] + sl2['price']) / 2
                    if not any(abs(e['level'] - level) / level < tolerance for e in eql):
                        eql.append({
                            'level': round(level, 2),
                            'type': 'support',
                            'signal': 'BUY',
                            'distance_pct': round(abs(price - level) / price * 100, 2),
                            'liquidity': 'high',
                            'message': f'Equal Lows at ${level:.2f} - Liquidity below'
                        })
        
        # Sort by distance
        eqh.sort(key=lambda x: x['distance_pct'])
        eql.sort(key=lambda x: x['distance_pct'])
        
        return {
            'equal_highs': eqh[:5],
            'equal_lows': eql[:5],
            'nearest_liquidity_above': eqh[0] if eqh else None,
            'nearest_liquidity_below': eql[0] if eql else None
        }
    
    # ==================== Premium/Discount Zones ====================
    
    def calc_premium_discount_zones(self, swing_highs: List[Dict], swing_lows: List[Dict]) -> Dict:
        """
        Calculate Premium and Discount zones based on recent range
        
        Premium Zone: Upper 50% of range (sell zone)
        Discount Zone: Lower 50% of range (buy zone)
        Equilibrium: 50% level
        """
        if not swing_highs or not swing_lows:
            return None
        
        # Get range from recent swing points
        recent_highs = swing_highs[-5:] if len(swing_highs) >= 5 else swing_highs
        recent_lows = swing_lows[-5:] if len(swing_lows) >= 5 else swing_lows
        
        range_high = max(sh['price'] for sh in recent_highs)
        range_low = min(sl['price'] for sl in recent_lows)
        
        equilibrium = (range_high + range_low) / 2
        price = self.df['Close'].iloc[-1]
        
        # Fibonacci levels
        fib_levels = {
            '0.0': range_low,
            '0.236': range_low + (range_high - range_low) * 0.236,
            '0.382': range_low + (range_high - range_low) * 0.382,
            '0.5': equilibrium,
            '0.618': range_low + (range_high - range_low) * 0.618,
            '0.786': range_low + (range_high - range_low) * 0.786,
            '1.0': range_high
        }
        
        # Determine current zone
        if price >= equilibrium:
            current_zone = 'premium'
            zone_signal = 'SELL'
            zone_message = 'Price in Premium Zone - Look for sells'
        else:
            current_zone = 'discount'
            zone_signal = 'BUY'
            zone_message = 'Price in Discount Zone - Look for buys'
        
        return {
            'premium': {
                'high': round(range_high, 2),
                'low': round(equilibrium, 2),
                'signal': 'SELL'
            },
            'discount': {
                'high': round(equilibrium, 2),
                'low': round(range_low, 2),
                'signal': 'BUY'
            },
            'equilibrium': round(equilibrium, 2),
            'current_zone': current_zone,
            'zone_signal': zone_signal,
            'zone_message': zone_message,
            'fibonacci': {k: round(v, 2) for k, v in fib_levels.items()},
            'range_pct': round((range_high - range_low) / range_low * 100, 2)
        }

    
    # ==================== Technical Indicators ====================
    
    def calc_indicators(self) -> Dict:
        """Calculate additional technical indicators"""
        if self.df is None or len(self.df) < 20:
            return {}
        
        closes = self.df['Close'].values
        highs = self.df['High'].values
        lows = self.df['Low'].values
        
        # RSI
        rsi = self._calc_rsi(closes, 14)
        
        # ATR (Average True Range)
        atr = self._calc_atr(highs, lows, closes, 14)
        
        # Moving Averages
        ma20 = np.mean(closes[-20:]) if len(closes) >= 20 else closes[-1]
        ma50 = np.mean(closes[-50:]) if len(closes) >= 50 else closes[-1]
        
        price = closes[-1]
        
        return {
            'rsi': {
                'value': round(rsi, 2),
                'signal': 'OVERSOLD' if rsi < 30 else 'OVERBOUGHT' if rsi > 70 else 'NEUTRAL'
            },
            'atr': {
                'value': round(atr, 2),
                'pct': round(atr / price * 100, 2)
            },
            'ma20': round(ma20, 2),
            'ma50': round(ma50, 2),
            'price_vs_ma20': 'above' if price > ma20 else 'below',
            'price_vs_ma50': 'above' if price > ma50 else 'below'
        }
    
    def _calc_rsi(self, prices: np.ndarray, period: int = 14) -> float:
        """Calculate RSI"""
        if len(prices) < period + 1:
            return 50.0
        
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))
    
    def _calc_atr(self, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int = 14) -> float:
        """Calculate Average True Range"""
        if len(closes) < period + 1:
            return 0.0
        
        tr_list = []
        for i in range(1, len(closes)):
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1])
            )
            tr_list.append(tr)
        
        return np.mean(tr_list[-period:])
    
    # ==================== Alert Generation ====================
    
    def generate_alerts(self, order_blocks: List[Dict], fvgs: List[Dict], 
                        structure: Dict, zones: Dict, liquidity: Dict) -> List[Dict]:
        """Generate actionable alerts based on analysis"""
        alerts = []
        price = self.df['Close'].iloc[-1]
        
        # Order Block alerts (within 3%)
        for ob in order_blocks:
            if ob['distance_pct'] <= 3.0:
                alerts.append({
                    'type': ob['type'],
                    'signal': ob['signal'],
                    'priority': 'high' if ob['distance_pct'] <= 1.5 else 'medium',
                    'message': f"{ob['signal']} Zone #{ob['rank']} at ${ob['mid']:.2f} ({ob['distance_pct']:.1f}% away)",
                    'level': ob['mid'],
                    'distance_pct': ob['distance_pct']
                })
        
        # FVG alerts (within 2%)
        for fvg in fvgs:
            if fvg['distance_pct'] <= 2.0:
                alerts.append({
                    'type': f"fvg_{fvg['type']}",
                    'signal': fvg['signal'],
                    'priority': 'medium',
                    'message': f"FVG {fvg['signal']} at ${fvg['mid']:.2f} ({fvg['distance_pct']:.1f}% away)",
                    'level': fvg['mid'],
                    'distance_pct': fvg['distance_pct']
                })
        
        # Structure break alerts
        if structure.get('bos'):
            for bos in structure['bos']:
                alerts.append({
                    'type': f"bos_{bos['type']}",
                    'signal': bos['signal'],
                    'priority': 'high',
                    'message': bos['message'],
                    'level': bos['level'],
                    'distance_pct': 0
                })
        
        if structure.get('choch'):
            choch = structure['choch']
            alerts.append({
                'type': f"choch_{choch['type']}",
                'signal': choch['signal'],
                'priority': 'critical',
                'message': choch['message'],
                'level': choch['level'],
                'distance_pct': 0
            })
        
        # Zone alerts
        if zones:
            if zones['current_zone'] == 'premium':
                alerts.append({
                    'type': 'zone_premium',
                    'signal': 'SELL',
                    'priority': 'low',
                    'message': zones['zone_message'],
                    'level': zones['equilibrium'],
                    'distance_pct': 0
                })
            elif zones['current_zone'] == 'discount':
                alerts.append({
                    'type': 'zone_discount',
                    'signal': 'BUY',
                    'priority': 'low',
                    'message': zones['zone_message'],
                    'level': zones['equilibrium'],
                    'distance_pct': 0
                })
        
        # Sort by priority
        priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        alerts.sort(key=lambda x: priority_order.get(x.get('priority', 'low'), 3))
        
        return alerts

    
    # ==================== Main Analysis ====================
    
    def analyze(self) -> Optional[Dict]:
        """
        Run complete SMC analysis
        Returns comprehensive analysis result
        """
        print(f'  Analyzing {self.symbol}...')
        
        if not self.fetch_data():
            print(f'  [FAIL] No data for {self.symbol}')
            return None
        
        # Find swing points at different timeframes
        swing_h, swing_l = self.find_swing_points(length=5)
        major_swing_h, major_swing_l = self.find_swing_points(length=10)
        
        # Detect trend
        trend = self.detect_trend(swing_h, swing_l)
        
        # Find Order Blocks
        order_blocks = self.find_order_blocks(swing_h, swing_l, max_blocks=10)
        major_obs = self.find_order_blocks(major_swing_h, major_swing_l, max_blocks=5)
        
        # Find Fair Value Gaps
        fvgs = self.find_fair_value_gaps()
        
        # Detect structure breaks
        structure = self.detect_structure_breaks(swing_h, swing_l)
        
        # Find liquidity zones
        liquidity = self.find_liquidity_zones(swing_h, swing_l)
        
        # Calculate zones
        zones = self.calc_premium_discount_zones(swing_h, swing_l)
        
        # Calculate indicators
        indicators = self.calc_indicators()
        
        # Generate alerts
        alerts = self.generate_alerts(order_blocks, fvgs, structure, zones, liquidity)
        
        # Get current price
        price = float(self.df['Close'].iloc[-1])
        
        # Find nearest zones
        nearest_buy = next((ob for ob in order_blocks if ob['signal'] == 'BUY'), None)
        nearest_sell = next((ob for ob in order_blocks if ob['signal'] == 'SELL'), None)
        
        return {
            'symbol': self.symbol,
            'current_price': round(price, 2),
            'interval': self.interval,
            'data_source': self.data_source,
            'candles_analyzed': len(self.df),
            'last_updated': datetime.now().isoformat(),
            
            # Trend Analysis
            'trend': trend,
            
            # Order Blocks
            'order_blocks': order_blocks,
            'major_order_blocks': major_obs,
            'nearest_buy_zone': nearest_buy,
            'nearest_sell_zone': nearest_sell,
            
            # Fair Value Gaps
            'fair_value_gaps': fvgs,
            
            # Structure
            'structure_breaks': structure,
            
            # Liquidity
            'liquidity_zones': liquidity,
            
            # Zones
            'zones': zones,
            
            # Indicators
            'indicators': indicators,
            
            # Summary
            'ob_summary': {
                'total_buy': len([o for o in order_blocks if o['signal'] == 'BUY']),
                'total_sell': len([o for o in order_blocks if o['signal'] == 'SELL']),
                'total_fvg': len(fvgs)
            },
            
            # Alerts
            'alerts': alerts,
            'alert_count': len(alerts)
        }


# ==================== Batch Analysis ====================

def analyze_watchlist(symbols: List[str], interval: str = '1h') -> Dict:
    """Analyze multiple symbols"""
    results = {}
    
    for symbol in symbols:
        try:
            smc = SMCCalculator(symbol, interval=interval)
            result = smc.analyze()
            if result:
                results[symbol] = result
        except Exception as e:
            print(f'  [ERROR] {symbol}: {e}')
    
    return results


# ==================== Main Entry Point ====================

if __name__ == '__main__':
    import sys
    
    # Load watchlist
    watchlist = []
    interval = '1h'
    
    try:
        with open('data/watchlist.json', 'r') as f:
            d = json.load(f)
            watchlist = d.get('symbols', [])
            interval = d.get('interval', '1h')
    except:
        pass
    
    if not watchlist:
        watchlist = os.environ.get('WATCHLIST', 'AAPL,TSLA,NVDA').split(',')
        interval = os.environ.get('INTERVAL', '1h')
    
    print(f'{"=" * 60}')
    print(f'🤖 SMC Calculator v2.0 - Professional Grade')
    print(f'{"=" * 60}')
    print(f'Watchlist: {watchlist}')
    print(f'Interval: {interval}')
    print(f'{"=" * 60}\n')
    
    results = analyze_watchlist(watchlist, interval)
    
    # Save results
    os.makedirs('data', exist_ok=True)
    output = {
        'generated_at': datetime.now().isoformat(),
        'stocks': results
    }
    
    with open('data/smc_data.json', 'w') as f:
        json.dump(output, f, indent=2, default=str)
    
    # Print summary
    print(f'\n{"=" * 60}')
    print('📊 ANALYSIS SUMMARY')
    print(f'{"=" * 60}')
    
    for sym, d in results.items():
        trend_emoji = '🟢' if d['trend']['direction'] == 'bullish' else '🔴' if d['trend']['direction'] == 'bearish' else '🟡'
        print(f"\n{trend_emoji} {sym} @ ${d['current_price']:.2f}")
        print(f"   Trend: {d['trend']['direction'].upper()} ({d['trend']['structure']})")
        print(f"   Order Blocks: {d['ob_summary']['total_buy']} BUY / {d['ob_summary']['total_sell']} SELL")
        print(f"   FVGs: {d['ob_summary']['total_fvg']}")
        
        if d.get('alerts'):
            print(f"   ⚠️ Alerts ({len(d['alerts'])}):")
            for alert in d['alerts'][:3]:
                print(f"      • {alert['message']}")
    
    print(f'\n{"=" * 60}')
    print('✅ Saved to data/smc_data.json')
