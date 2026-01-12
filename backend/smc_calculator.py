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
                          max_blocks: int = 10, use_volume_filter: bool = True,
                          use_ema_filter: bool = True) -> List[Dict]:
        """
        Find Order Blocks - institutional supply/demand zones
        
        Bullish OB: Last bearish candle before a strong bullish move (use candle BODY, not wick)
        Bearish OB: Last bullish candle before a strong bearish move (use candle BODY, not wick)
        
        NEW: Volume Confirmation - OBs with high volume are stronger
        NEW: EMA Trend Filter - Filter OBs that go against the main trend
        
        Based on LuxAlgo Smart Money Concepts methodology
        """
        if self.df is None or len(self.df) < 20:
            return []
        
        obs = []
        opens = self.df['Open'].values
        highs = self.df['High'].values
        lows = self.df['Low'].values
        closes = self.df['Close'].values
        volumes = self.df['Volume'].values
        price = closes[-1]
        
        # Calculate ATR for volatility filter (like LuxAlgo)
        atr = self._calc_atr(highs, lows, closes, 14)
        
        # Calculate EMA for trend filter
        ema20 = self._calc_ema(closes, 20)
        ema50 = self._calc_ema(closes, 50)
        ema200 = self._calc_ema(closes, 200) if len(closes) >= 200 else self._calc_ema(closes, len(closes))
        
        # Determine main trend from EMA
        ema_bullish = price > ema50 and ema20 > ema50
        ema_bearish = price < ema50 and ema20 < ema50
        
        # Calculate average volume for comparison
        avg_volume = np.mean(volumes[-20:]) if len(volumes) >= 20 else np.mean(volumes)
        
        # Find Bearish Order Blocks (supply zones) - at swing highs
        for sh in swing_highs:
            idx = sh['index']
            if idx <= 5 or idx >= len(closes) - 1:
                continue
            
            # Look for the last bullish candle before the swing high
            for j in range(idx - 1, max(0, idx - 10), -1):
                if closes[j] > opens[j]:  # Bullish candle
                    # Use BODY for OB zone (not wick) - like LuxAlgo
                    ob_high = float(max(opens[j], closes[j]))  # Top of body
                    ob_low = float(min(opens[j], closes[j]))   # Bottom of body
                    
                    # Filter out high volatility bars (wick > body)
                    body_size = abs(closes[j] - opens[j])
                    wick_size = (highs[j] - max(opens[j], closes[j])) + (min(opens[j], closes[j]) - lows[j])
                    if wick_size > body_size * 2:
                        continue  # Skip high volatility candles
                    
                    # Check if OB is still valid (not mitigated)
                    mitigated = any(closes[k] > ob_high for k in range(j + 1, len(closes)))
                    
                    if not mitigated:
                        mid = (ob_high + ob_low) / 2
                        distance = abs(price - mid)
                        
                        # Volume confirmation
                        ob_volume = volumes[j]
                        vol_ratio = ob_volume / avg_volume if avg_volume > 0 else 1.0
                        vol_confirmed = vol_ratio > 1.2
                        
                        # EMA trend filter - Bearish OB is stronger when trend is bearish
                        trend_aligned = ema_bearish or not use_ema_filter
                        
                        # Calculate quality score
                        quality_score = self._calc_ob_quality(
                            ob_type='bearish',
                            vol_ratio=vol_ratio,
                            trend_aligned=trend_aligned,
                            strength=self._calc_ob_strength(j, idx, 'bearish')
                        )
                        
                        obs.append({
                            'type': 'bearish',
                            'signal': 'SELL',
                            'high': round(ob_high, 2),
                            'low': round(ob_low, 2),
                            'mid': round(mid, 2),
                            'distance': round(distance, 2),
                            'distance_pct': round(distance / price * 100, 2),
                            'strength': self._calc_ob_strength(j, idx, 'bearish'),
                            'date': str(self.df['Date'].iloc[j]),
                            'mitigated': False,
                            # NEW: Volume data
                            'volume': {
                                'value': int(ob_volume),
                                'ratio': round(vol_ratio, 2),
                                'confirmed': vol_confirmed,
                                'signal': 'STRONG' if vol_ratio > 2.0 else 'MODERATE' if vol_ratio > 1.2 else 'WEAK'
                            },
                            # NEW: Trend alignment
                            'trend_aligned': trend_aligned,
                            'quality_score': quality_score
                        })
                    break
        
        # Find Bullish Order Blocks (demand zones) - at swing lows
        for sl in swing_lows:
            idx = sl['index']
            if idx <= 5 or idx >= len(closes) - 1:
                continue
            
            # Look for the last bearish candle before the swing low
            for j in range(idx - 1, max(0, idx - 10), -1):
                if closes[j] < opens[j]:  # Bearish candle
                    # Use BODY for OB zone (not wick) - like LuxAlgo
                    ob_high = float(max(opens[j], closes[j]))  # Top of body
                    ob_low = float(min(opens[j], closes[j]))   # Bottom of body
                    
                    # Filter out high volatility bars
                    body_size = abs(closes[j] - opens[j])
                    wick_size = (highs[j] - max(opens[j], closes[j])) + (min(opens[j], closes[j]) - lows[j])
                    if wick_size > body_size * 2:
                        continue
                    
                    # Check if OB is still valid (not mitigated)
                    mitigated = any(closes[k] < ob_low for k in range(j + 1, len(closes)))
                    
                    if not mitigated:
                        mid = (ob_high + ob_low) / 2
                        distance = abs(price - mid)
                        
                        # Volume confirmation
                        ob_volume = volumes[j]
                        vol_ratio = ob_volume / avg_volume if avg_volume > 0 else 1.0
                        vol_confirmed = vol_ratio > 1.2
                        
                        # EMA trend filter - Bullish OB is stronger when trend is bullish
                        trend_aligned = ema_bullish or not use_ema_filter
                        
                        # Calculate quality score
                        quality_score = self._calc_ob_quality(
                            ob_type='bullish',
                            vol_ratio=vol_ratio,
                            trend_aligned=trend_aligned,
                            strength=self._calc_ob_strength(j, idx, 'bullish')
                        )
                        
                        obs.append({
                            'type': 'bullish',
                            'signal': 'BUY',
                            'high': round(ob_high, 2),
                            'low': round(ob_low, 2),
                            'mid': round(mid, 2),
                            'distance': round(distance, 2),
                            'distance_pct': round(distance / price * 100, 2),
                            'strength': self._calc_ob_strength(j, idx, 'bullish'),
                            'date': str(self.df['Date'].iloc[j]),
                            'mitigated': False,
                            # NEW: Volume data
                            'volume': {
                                'value': int(ob_volume),
                                'ratio': round(vol_ratio, 2),
                                'confirmed': vol_confirmed,
                                'signal': 'STRONG' if vol_ratio > 2.0 else 'MODERATE' if vol_ratio > 1.2 else 'WEAK'
                            },
                            # NEW: Trend alignment
                            'trend_aligned': trend_aligned,
                            'quality_score': quality_score
                        })
                    break
        
        # Sort by quality score (higher is better), then by distance
        obs.sort(key=lambda x: (-x['quality_score'], x['distance']))
        
        # Filter overlapping Order Blocks (merge OBs that are too close)
        filtered_obs = self._filter_overlapping_obs(obs, price)
        
        for i, ob in enumerate(filtered_obs):
            ob['rank'] = i + 1
            # Check if price is currently IN the order block zone
            ob['in_zone'] = ob['low'] <= price <= ob['high']
        
        return filtered_obs[:max_blocks]
    
    def _calc_ob_quality(self, ob_type: str, vol_ratio: float, trend_aligned: bool, strength: str) -> int:
        """
        Calculate Order Block quality score (0-100)
        
        Factors:
        - Volume confirmation (40 points max)
        - Trend alignment (30 points max)
        - OB strength (30 points max)
        """
        score = 0
        
        # Volume score (0-40)
        if vol_ratio > 2.0:
            score += 40
        elif vol_ratio > 1.5:
            score += 30
        elif vol_ratio > 1.2:
            score += 20
        elif vol_ratio > 0.8:
            score += 10
        
        # Trend alignment score (0-30)
        if trend_aligned:
            score += 30
        else:
            score += 10  # Still give some points for counter-trend (can be reversal)
        
        # Strength score (0-30)
        if strength == 'strong':
            score += 30
        elif strength == 'moderate':
            score += 20
        else:
            score += 10
        
        return score
    
    def _filter_overlapping_obs(self, obs: List[Dict], price: float, threshold_pct: float = 3.0) -> List[Dict]:
        """
        Filter overlapping Order Blocks - keep only the strongest one in each zone
        OBs within threshold_pct of each other are considered overlapping
        """
        if len(obs) <= 1:
            return obs
        
        # Separate by type
        bullish_obs = [ob for ob in obs if ob['type'] == 'bullish']
        bearish_obs = [ob for ob in obs if ob['type'] == 'bearish']
        
        def filter_by_type(obs_list: List[Dict]) -> List[Dict]:
            if len(obs_list) <= 1:
                return obs_list
            
            filtered = []
            used = set()
            
            for i, ob1 in enumerate(obs_list):
                if i in used:
                    continue
                
                # Find all OBs that overlap with this one
                overlapping = [ob1]
                for j, ob2 in enumerate(obs_list[i+1:], i+1):
                    if j in used:
                        continue
                    
                    # Check if OBs overlap (zones intersect or are very close)
                    overlap = (ob1['low'] <= ob2['high'] and ob2['low'] <= ob1['high']) or \
                              abs(ob1['mid'] - ob2['mid']) / price * 100 < threshold_pct
                    
                    if overlap:
                        overlapping.append(ob2)
                        used.add(j)
                
                # Keep the strongest OB from overlapping group
                strength_order = {'strong': 0, 'moderate': 1, 'weak': 2}
                best_ob = min(overlapping, key=lambda x: (strength_order.get(x['strength'], 2), x['distance']))
                filtered.append(best_ob)
                used.add(i)
            
            return filtered
        
        # Filter each type separately
        filtered_bullish = filter_by_type(bullish_obs)
        filtered_bearish = filter_by_type(bearish_obs)
        
        # Combine and sort by distance
        result = filtered_bullish + filtered_bearish
        result.sort(key=lambda x: x['distance'])
        
        return result
    
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
        """Calculate additional technical indicators including EMA and Volume"""
        if self.df is None or len(self.df) < 20:
            return {}
        
        closes = self.df['Close'].values
        highs = self.df['High'].values
        lows = self.df['Low'].values
        volumes = self.df['Volume'].values
        
        # RSI
        rsi = self._calc_rsi(closes, 14)
        
        # ATR (Average True Range)
        atr = self._calc_atr(highs, lows, closes, 14)
        
        # Simple Moving Averages
        ma20 = np.mean(closes[-20:]) if len(closes) >= 20 else closes[-1]
        ma50 = np.mean(closes[-50:]) if len(closes) >= 50 else closes[-1]
        
        # Exponential Moving Averages (more responsive to recent price)
        ema20 = self._calc_ema(closes, 20)
        ema50 = self._calc_ema(closes, 50)
        ema200 = self._calc_ema(closes, 200) if len(closes) >= 200 else self._calc_ema(closes, len(closes))
        
        # Volume Analysis
        vol_avg = np.mean(volumes[-20:]) if len(volumes) >= 20 else np.mean(volumes)
        vol_current = volumes[-1]
        vol_ratio = vol_current / vol_avg if vol_avg > 0 else 1.0
        
        price = closes[-1]
        
        # EMA Trend Analysis
        ema_trend = self._analyze_ema_trend(price, ema20, ema50, ema200)
        
        return {
            'rsi': {
                'value': round(rsi, 2),
                'signal': 'OVERSOLD' if rsi < 30 else 'OVERBOUGHT' if rsi > 70 else 'NEUTRAL'
            },
            'atr': {
                'value': round(atr, 2),
                'pct': round(atr / price * 100, 2)
            },
            # SMA
            'ma20': round(ma20, 2),
            'ma50': round(ma50, 2),
            'price_vs_ma20': 'above' if price > ma20 else 'below',
            'price_vs_ma50': 'above' if price > ma50 else 'below',
            # EMA
            'ema20': round(ema20, 2),
            'ema50': round(ema50, 2),
            'ema200': round(ema200, 2),
            'price_vs_ema20': 'above' if price > ema20 else 'below',
            'price_vs_ema50': 'above' if price > ema50 else 'below',
            'price_vs_ema200': 'above' if price > ema200 else 'below',
            'ema_trend': ema_trend,
            # Volume
            'volume': {
                'current': int(vol_current),
                'avg_20': int(vol_avg),
                'ratio': round(vol_ratio, 2),
                'signal': 'HIGH' if vol_ratio > 1.5 else 'LOW' if vol_ratio < 0.5 else 'NORMAL'
            }
        }
    
    def _calc_ema(self, prices: np.ndarray, period: int) -> float:
        """Calculate Exponential Moving Average"""
        if len(prices) < period:
            return float(np.mean(prices))
        
        multiplier = 2 / (period + 1)
        ema = prices[0]
        
        for price in prices[1:]:
            ema = (price - ema) * multiplier + ema
        
        return float(ema)
    
    def _analyze_ema_trend(self, price: float, ema20: float, ema50: float, ema200: float) -> Dict:
        """
        Analyze trend using EMA alignment
        
        Strong Bullish: Price > EMA20 > EMA50 > EMA200
        Bullish: Price > EMA20 > EMA50
        Bearish: Price < EMA20 < EMA50
        Strong Bearish: Price < EMA20 < EMA50 < EMA200
        """
        # Count bullish signals
        bullish_count = 0
        if price > ema20: bullish_count += 1
        if price > ema50: bullish_count += 1
        if price > ema200: bullish_count += 1
        if ema20 > ema50: bullish_count += 1
        if ema50 > ema200: bullish_count += 1
        
        # Determine trend
        if bullish_count >= 5:
            trend = 'STRONG_BULLISH'
            signal = 'BUY'
            strength = 100
        elif bullish_count >= 4:
            trend = 'BULLISH'
            signal = 'BUY'
            strength = 75
        elif bullish_count >= 3:
            trend = 'NEUTRAL'
            signal = 'HOLD'
            strength = 50
        elif bullish_count >= 2:
            trend = 'BEARISH'
            signal = 'SELL'
            strength = 25
        else:
            trend = 'STRONG_BEARISH'
            signal = 'SELL'
            strength = 0
        
        # Check for Golden Cross / Death Cross
        cross = None
        if ema50 > ema200 and ema20 > ema50:
            cross = 'GOLDEN_CROSS'
        elif ema50 < ema200 and ema20 < ema50:
            cross = 'DEATH_CROSS'
        
        return {
            'trend': trend,
            'signal': signal,
            'strength': strength,
            'cross': cross,
            'alignment': f"Price {'>' if price > ema20 else '<'} EMA20 {'>' if ema20 > ema50 else '<'} EMA50 {'>' if ema50 > ema200 else '<'} EMA200"
        }
    
    # ==================== Volume Confirmation ====================
    
    def calc_volume_at_ob(self, ob_index: int, lookback: int = 3) -> Dict:
        """
        Calculate volume characteristics at Order Block formation
        
        High volume at OB = Strong institutional interest
        Low volume at OB = Weak zone, may not hold
        """
        if self.df is None or ob_index < lookback:
            return {'confirmed': False, 'ratio': 1.0}
        
        volumes = self.df['Volume'].values
        
        # Volume at OB formation
        ob_volume = volumes[ob_index]
        
        # Average volume before OB
        avg_volume = np.mean(volumes[max(0, ob_index - 20):ob_index])
        
        if avg_volume == 0:
            return {'confirmed': False, 'ratio': 1.0}
        
        ratio = ob_volume / avg_volume
        
        # Volume spike = institutional activity
        confirmed = ratio > 1.2  # 20% above average
        
        return {
            'confirmed': confirmed,
            'ratio': round(ratio, 2),
            'ob_volume': int(ob_volume),
            'avg_volume': int(avg_volume),
            'signal': 'STRONG' if ratio > 2.0 else 'MODERATE' if ratio > 1.2 else 'WEAK'
        }
    
    def _get_ob_volume_confirmation(self, ob_idx: int) -> Dict:
        """Get volume confirmation for an Order Block"""
        return self.calc_volume_at_ob(ob_idx)
    
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
    
    # ==================== Trade Setup Calculation ====================
    
    def calculate_trade_setup(self, ob: Dict, zones: Dict, indicators: Dict) -> Dict:
        """
        Calculate complete trade setup with SL/TP and Risk/Reward
        
        For Bullish OB (BUY):
        - Entry: OB high (top of zone)
        - Stop Loss: Below OB low (with ATR buffer)
        - Take Profit 1: Next resistance / 1:1 RR
        - Take Profit 2: 1:2 RR
        - Take Profit 3: 1:3 RR
        
        For Bearish OB (SELL):
        - Entry: OB low (bottom of zone)
        - Stop Loss: Above OB high (with ATR buffer)
        - Take Profit 1: Next support / 1:1 RR
        - Take Profit 2: 1:2 RR
        - Take Profit 3: 1:3 RR
        """
        if self.df is None:
            return {}
        
        price = float(self.df['Close'].iloc[-1])
        atr = indicators.get('atr', {}).get('value', price * 0.02)
        atr_buffer = atr * 0.5  # Half ATR as buffer
        
        if ob['type'] == 'bullish':
            # BUY setup
            entry = ob['high']  # Enter at top of OB
            stop_loss = ob['low'] - atr_buffer  # SL below OB with buffer
            risk = entry - stop_loss
            
            # Take Profit levels
            tp1 = entry + risk * 1.0  # 1:1 RR
            tp2 = entry + risk * 2.0  # 1:2 RR
            tp3 = entry + risk * 3.0  # 1:3 RR
            
            # Use equilibrium as potential TP if available
            if zones and zones.get('equilibrium'):
                eq = zones['equilibrium']
                if eq > entry:
                    tp1 = eq
            
            direction = 'LONG'
            
        else:
            # SELL setup
            entry = ob['low']  # Enter at bottom of OB
            stop_loss = ob['high'] + atr_buffer  # SL above OB with buffer
            risk = stop_loss - entry
            
            # Take Profit levels
            tp1 = entry - risk * 1.0  # 1:1 RR
            tp2 = entry - risk * 2.0  # 1:2 RR
            tp3 = entry - risk * 3.0  # 1:3 RR
            
            # Use equilibrium as potential TP if available
            if zones and zones.get('equilibrium'):
                eq = zones['equilibrium']
                if eq < entry:
                    tp1 = eq
            
            direction = 'SHORT'
        
        # Calculate risk/reward for each TP
        rr1 = abs(tp1 - entry) / risk if risk > 0 else 0
        rr2 = abs(tp2 - entry) / risk if risk > 0 else 0
        rr3 = abs(tp3 - entry) / risk if risk > 0 else 0
        
        # Risk percentage (how much price needs to move to hit SL)
        risk_pct = abs(entry - stop_loss) / entry * 100
        
        return {
            'direction': direction,
            'entry': round(entry, 2),
            'stop_loss': round(stop_loss, 2),
            'take_profit_1': round(tp1, 2),
            'take_profit_2': round(tp2, 2),
            'take_profit_3': round(tp3, 2),
            'risk': round(risk, 2),
            'risk_pct': round(risk_pct, 2),
            'risk_reward': {
                'tp1': round(rr1, 2),
                'tp2': round(rr2, 2),
                'tp3': round(rr3, 2)
            },
            'recommended_rr': round(rr2, 2),  # 1:2 is standard
            'valid': risk_pct <= 5.0  # Invalid if risk > 5%
        }
    
    def calculate_confluence_score(self, ob: Dict, trend: Dict, indicators: Dict, 
                                    zones: Dict, structure: Dict) -> Dict:
        """
        Calculate confluence score for trade entry
        
        Factors:
        - OB Quality Score (0-30)
        - Trend Alignment (0-20)
        - EMA Alignment (0-15)
        - RSI Confirmation (0-15)
        - Zone Position (0-10)
        - Structure Confirmation (0-10)
        
        Total: 0-100
        """
        score = 0
        factors = []
        
        # 1. OB Quality Score (0-30)
        ob_quality = ob.get('quality_score', 50)
        ob_score = int(ob_quality * 0.3)
        score += ob_score
        factors.append(f"OB Quality: {ob_score}/30")
        
        # 2. Trend Alignment (0-20)
        trend_dir = trend.get('direction', 'neutral')
        if (ob['type'] == 'bullish' and trend_dir == 'bullish') or \
           (ob['type'] == 'bearish' and trend_dir == 'bearish'):
            score += 20
            factors.append("Trend Aligned: 20/20")
        elif trend_dir == 'neutral':
            score += 10
            factors.append("Trend Neutral: 10/20")
        else:
            score += 5  # Counter-trend (can be reversal)
            factors.append("Counter-Trend: 5/20")
        
        # 3. EMA Alignment (0-15)
        ema_trend = indicators.get('ema_trend', {})
        ema_signal = ema_trend.get('signal', 'HOLD')
        if (ob['type'] == 'bullish' and ema_signal == 'BUY') or \
           (ob['type'] == 'bearish' and ema_signal == 'SELL'):
            score += 15
            factors.append("EMA Aligned: 15/15")
        elif ema_signal == 'HOLD':
            score += 8
            factors.append("EMA Neutral: 8/15")
        else:
            score += 3
            factors.append("EMA Against: 3/15")
        
        # 4. RSI Confirmation (0-15)
        rsi = indicators.get('rsi', {})
        rsi_val = rsi.get('value', 50)
        rsi_signal = rsi.get('signal', 'NEUTRAL')
        
        if ob['type'] == 'bullish':
            if rsi_signal == 'OVERSOLD' or rsi_val < 40:
                score += 15
                factors.append("RSI Oversold: 15/15")
            elif rsi_val < 50:
                score += 10
                factors.append("RSI Favorable: 10/15")
            else:
                score += 5
                factors.append("RSI Neutral: 5/15")
        else:
            if rsi_signal == 'OVERBOUGHT' or rsi_val > 60:
                score += 15
                factors.append("RSI Overbought: 15/15")
            elif rsi_val > 50:
                score += 10
                factors.append("RSI Favorable: 10/15")
            else:
                score += 5
                factors.append("RSI Neutral: 5/15")
        
        # 5. Zone Position (0-10)
        if zones:
            current_zone = zones.get('current_zone', '')
            if (ob['type'] == 'bullish' and current_zone == 'discount') or \
               (ob['type'] == 'bearish' and current_zone == 'premium'):
                score += 10
                factors.append("Zone Optimal: 10/10")
            else:
                score += 3
                factors.append("Zone Suboptimal: 3/10")
        else:
            score += 5
            factors.append("Zone Unknown: 5/10")
        
        # 6. Structure Confirmation (0-10)
        bos = structure.get('bos', [])
        choch = structure.get('choch')
        
        if choch and choch['type'] == ob['type']:
            score += 10
            factors.append("CHoCH Confirmed: 10/10")
        elif any(b['type'] == ob['type'] for b in bos):
            score += 7
            factors.append("BOS Confirmed: 7/10")
        else:
            score += 3
            factors.append("No Structure: 3/10")
        
        # Determine signal strength
        if score >= 80:
            strength = 'STRONG'
            recommendation = 'High probability setup'
        elif score >= 60:
            strength = 'MODERATE'
            recommendation = 'Good setup, manage risk'
        elif score >= 40:
            strength = 'WEAK'
            recommendation = 'Low probability, wait for better'
        else:
            strength = 'AVOID'
            recommendation = 'Do not trade this setup'
        
        return {
            'score': score,
            'max_score': 100,
            'strength': strength,
            'recommendation': recommendation,
            'factors': factors
        }
    
    # ==================== Alert Generation ====================
    
    def generate_alerts(self, order_blocks: List[Dict], fvgs: List[Dict], 
                        structure: Dict, zones: Dict, liquidity: Dict) -> List[Dict]:
        """Generate actionable alerts based on analysis (English messages - frontend will translate)"""
        alerts = []
        price = self.df['Close'].iloc[-1]
        
        # Order Block alerts - PRIORITY: Price IN zone > Very close > Approaching
        for ob in order_blocks:
            # Check if price is IN the Order Block zone (highest priority)
            if ob.get('in_zone', False) or (ob['low'] <= price <= ob['high']):
                action = 'Buy' if ob['type'] == 'bullish' else 'Sell'
                alerts.append({
                    'type': f"ob_entry_{ob['type']}",
                    'signal': ob['signal'],
                    'priority': 'critical',
                    'message': f"🎯 Price entered {ob['signal']} Order Block! (${ob['low']:.2f}-${ob['high']:.2f}) - {action} signal",
                    'level': ob['mid'],
                    'distance_pct': 0,
                    'ob_type': ob['type'],
                    'ob_high': ob['high'],
                    'ob_low': ob['low'],
                    'quality_score': ob.get('quality_score', 50),
                    'volume_confirmed': ob.get('volume', {}).get('confirmed', False),
                    'trend_aligned': ob.get('trend_aligned', False)
                })
            # Very close to OB (within 1.5%)
            elif ob['distance_pct'] <= 1.5:
                alerts.append({
                    'type': f"ob_near_{ob['type']}",
                    'signal': ob['signal'],
                    'priority': 'high',
                    'message': f"⚠️ Near {ob['signal']} Zone #{ob['rank']} at ${ob['mid']:.2f} ({ob['distance_pct']:.1f}% away)",
                    'level': ob['mid'],
                    'distance_pct': ob['distance_pct']
                })
            # Approaching OB (within 3%)
            elif ob['distance_pct'] <= 3.0:
                alerts.append({
                    'type': ob['type'],
                    'signal': ob['signal'],
                    'priority': 'medium',
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
        
        # Find Order Blocks (with Volume and EMA filters)
        order_blocks = self.find_order_blocks(swing_h, swing_l, max_blocks=10, 
                                               use_volume_filter=True, use_ema_filter=True)
        major_obs = self.find_order_blocks(major_swing_h, major_swing_l, max_blocks=5,
                                            use_volume_filter=True, use_ema_filter=True)
        
        # Find Fair Value Gaps
        fvgs = self.find_fair_value_gaps()
        
        # Detect structure breaks
        structure = self.detect_structure_breaks(swing_h, swing_l)
        
        # Find liquidity zones
        liquidity = self.find_liquidity_zones(swing_h, swing_l)
        
        # Calculate zones
        zones = self.calc_premium_discount_zones(swing_h, swing_l)
        
        # Calculate indicators (includes EMA and Volume)
        indicators = self.calc_indicators()
        
        # Generate alerts
        alerts = self.generate_alerts(order_blocks, fvgs, structure, zones, liquidity)
        
        # Get current price
        price = float(self.df['Close'].iloc[-1])
        
        # Find nearest zones
        nearest_buy = next((ob for ob in order_blocks if ob['signal'] == 'BUY'), None)
        nearest_sell = next((ob for ob in order_blocks if ob['signal'] == 'SELL'), None)
        
        # Count volume-confirmed OBs
        vol_confirmed_obs = [ob for ob in order_blocks if ob.get('volume', {}).get('confirmed', False)]
        trend_aligned_obs = [ob for ob in order_blocks if ob.get('trend_aligned', False)]
        
        return {
            'symbol': self.symbol,
            'current_price': round(price, 2),
            'interval': self.interval,
            'data_source': self.data_source,
            'candles_analyzed': len(self.df),
            'last_updated': datetime.now().isoformat(),
            
            # Trend Analysis
            'trend': trend,
            
            # EMA Trend (NEW)
            'ema_trend': indicators.get('ema_trend', {}),
            
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
            
            # Indicators (includes EMA and Volume)
            'indicators': indicators,
            
            # Summary (UPDATED)
            'ob_summary': {
                'total_buy': len([o for o in order_blocks if o['signal'] == 'BUY']),
                'total_sell': len([o for o in order_blocks if o['signal'] == 'SELL']),
                'total_fvg': len(fvgs),
                'volume_confirmed': len(vol_confirmed_obs),
                'trend_aligned': len(trend_aligned_obs),
                'high_quality': len([o for o in order_blocks if o.get('quality_score', 0) >= 70])
            },
            
            # Alerts
            'alerts': alerts,
            'alert_count': len(alerts),
            
            # Trade Setups (NEW) - Calculate for top OBs
            'trade_setups': self._generate_trade_setups(order_blocks[:3], zones, indicators, trend, structure)
        }
    
    def _generate_trade_setups(self, order_blocks: List[Dict], zones: Dict, 
                                indicators: Dict, trend: Dict, structure: Dict) -> List[Dict]:
        """Generate trade setups for top order blocks"""
        setups = []
        
        for ob in order_blocks:
            # Calculate trade setup (SL/TP)
            trade_setup = self.calculate_trade_setup(ob, zones, indicators)
            
            # Calculate confluence score
            confluence = self.calculate_confluence_score(ob, trend, indicators, zones, structure)
            
            setups.append({
                'ob_type': ob['type'],
                'signal': ob['signal'],
                'ob_zone': {
                    'high': ob['high'],
                    'low': ob['low'],
                    'mid': ob['mid']
                },
                'quality_score': ob.get('quality_score', 50),
                'trade_setup': trade_setup,
                'confluence': confluence,
                'recommendation': 'TRADE' if confluence['score'] >= 60 and trade_setup.get('valid', False) else 'WAIT'
            })
        
        # Sort by confluence score
        setups.sort(key=lambda x: x['confluence']['score'], reverse=True)
        
        return setups


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
    print(f'🤖 SMC Calculator v2.1 - Professional Grade')
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
        ema_trend = d.get('ema_trend', {}).get('trend', 'N/A')
        print(f"\n{trend_emoji} {sym} @ ${d['current_price']:.2f}")
        print(f"   Trend: {d['trend']['direction'].upper()} ({d['trend']['structure']})")
        print(f"   EMA Trend: {ema_trend}")
        print(f"   Order Blocks: {d['ob_summary']['total_buy']} BUY / {d['ob_summary']['total_sell']} SELL")
        print(f"   Volume Confirmed: {d['ob_summary'].get('volume_confirmed', 0)} | Trend Aligned: {d['ob_summary'].get('trend_aligned', 0)}")
        print(f"   High Quality OBs: {d['ob_summary'].get('high_quality', 0)}")
        print(f"   FVGs: {d['ob_summary']['total_fvg']}")
        
        # Show trade setups
        if d.get('trade_setups'):
            print(f"   📈 Trade Setups:")
            for setup in d['trade_setups'][:2]:
                conf = setup['confluence']
                ts = setup['trade_setup']
                rec = '✅' if setup['recommendation'] == 'TRADE' else '⏳'
                print(f"      {rec} {setup['signal']} @ ${setup['ob_zone']['mid']:.2f}")
                print(f"         Confluence: {conf['score']}/100 ({conf['strength']})")
                if ts.get('valid'):
                    print(f"         Entry: ${ts['entry']:.2f} | SL: ${ts['stop_loss']:.2f} | TP: ${ts['take_profit_2']:.2f}")
                    print(f"         Risk: {ts['risk_pct']:.1f}% | R:R = 1:{ts['risk_reward']['tp2']:.1f}")
        
        if d.get('alerts'):
            print(f"   ⚠️ Alerts ({len(d['alerts'])}):")
            for alert in d['alerts'][:3]:
                print(f"      • {alert['message']}")
    
    print(f'\n{"=" * 60}')
    print('✅ Saved to data/smc_data.json')

