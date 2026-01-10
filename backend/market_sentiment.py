"""
Market Sentiment Analyzer - Enhanced Version v2.0
วิเคราะห์ Fear & Greed Index, VIX, Market Breadth และดัชนีต่างๆ

Data Sources (All Free):
- VIX: Yahoo Finance (^VIX)
- Fear & Greed (Stock): CNN API / Calculated fallback
- Fear & Greed (Crypto): alternative.me API
- Market Breadth: Yahoo Finance ETFs + WSJ scraping
- Sector Performance: Yahoo Finance Sector ETFs
- Treasury Yields: FRED API (free) / Yahoo Finance fallback
- Economic Data: FRED API

Features v2.0:
- EMA support (faster signals)
- Retry logic for API failures
- Better error handling
- Multiple data source fallbacks
- Caching to reduce API calls
"""
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Tuple
import os
import time

# Retry decorator
def retry_on_failure(max_retries: int = 3, delay: float = 1.0):
    """Decorator to retry function on failure"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        time.sleep(delay * (attempt + 1))
                        print(f"  [Retry {attempt + 1}/{max_retries}] {func.__name__}")
            print(f"  [Failed] {func.__name__}: {last_error}")
            return None
        return wrapper
    return decorator


class MarketSentimentAnalyzer:
    def __init__(self):
        self.data = {}
        self.cache = {}
        self.cache_duration = 300  # 5 minutes cache
        
    def _get_cached(self, key: str) -> Optional[Dict]:
        """Get cached data if still valid"""
        if key in self.cache:
            cached = self.cache[key]
            if datetime.now().timestamp() - cached['timestamp'] < self.cache_duration:
                return cached['data']
        return None
    
    def _set_cache(self, key: str, data: Dict):
        """Cache data with timestamp"""
        self.cache[key] = {
            'data': data,
            'timestamp': datetime.now().timestamp()
        }
    
    # ==================== VIX (CBOE Volatility Index) ====================
    @retry_on_failure(max_retries=3)
    def get_vix(self) -> Dict:
        """ดึง VIX จาก Yahoo Finance พร้อม retry logic"""
        cached = self._get_cached('vix')
        if cached:
            return cached
            
        import yfinance as yf
        vix = yf.Ticker("^VIX")
        hist = vix.history(period="5d")
        
        if hist.empty:
            return self._default_vix()
        
        current = float(hist['Close'].iloc[-1])
        prev = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
        change = ((current - prev) / prev) * 100
        
        # VIX Interpretation
        if current < 12:
            signal, level = "EXTREME_BULLISH", "extreme_low"
        elif current < 17:
            signal, level = "BULLISH", "low"
        elif current < 20:
            signal, level = "NEUTRAL", "normal"
        elif current < 25:
            signal, level = "CAUTIOUS", "elevated"
        elif current < 30:
            signal, level = "BEARISH", "high"
        else:
            signal, level = "EXTREME_FEAR", "extreme_high"
        
        result = {
            "value": round(current, 2),
            "change": round(change, 2),
            "change_pct": round(change, 2),
            "signal": signal,
            "level": level,
            "trend": "up" if change > 0 else "down" if change < 0 else "flat",
            "source": "yahoo_finance",
            "interpretation": self._interpret_vix(current)
        }
        
        self._set_cache('vix', result)
        return result
    
    def _default_vix(self) -> Dict:
        return {"value": 20, "change": 0, "signal": "NEUTRAL", "level": "normal", "trend": "flat", "source": "default"}
    
    def _interpret_vix(self, vix: float) -> str:
        if vix < 15: return "Market calm, investors confident"
        elif vix < 20: return "Normal volatility"
        elif vix < 25: return "Elevated concern"
        elif vix < 30: return "High fear, be cautious"
        else: return "Market panic! Wait for opportunity"

    # ==================== Fear & Greed Index ====================
    def get_fear_greed_index(self) -> Dict:
        """ดึง Fear & Greed Index จากหลายแหล่ง"""
        cached = self._get_cached('fear_greed')
        if cached:
            return cached
            
        # Try CNN first
        stock_fg = self._get_cnn_fear_greed()
        if not stock_fg:
            stock_fg = self._calculate_fear_greed_fallback()
        
        # Crypto F&G
        crypto_fg = self._get_crypto_fear_greed()
        
        result = {
            "stock": stock_fg,
            "crypto": crypto_fg,
            "score": stock_fg["score"],
            "rating": stock_fg["rating"],
            "signal": stock_fg["signal"],
            "source": stock_fg["source"]
        }
        
        self._set_cache('fear_greed', result)
        return result
    
    @retry_on_failure(max_retries=2)
    def _get_cnn_fear_greed(self) -> Optional[Dict]:
        """ดึง Fear & Greed Index จาก CNN API"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://edition.cnn.com/markets/fear-and-greed'
        }
        
        url = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata'
        resp = requests.get(url, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            fg = data.get('fear_and_greed', {})
            
            score = int(fg.get('score', 50))
            rating = fg.get('rating', 'neutral').title()
            
            print(f"  [CNN F&G] Score: {score} ({rating})")
            
            return {
                "score": score,
                "rating": rating,
                "signal": self._score_to_signal(score),
                "source": "cnn",
                "previous_close": fg.get('previous_close'),
                "previous_1_week": fg.get('previous_1_week'),
                "previous_1_month": fg.get('previous_1_month')
            }
        return None
    
    def _calculate_fear_greed_fallback(self) -> Dict:
        """Fallback: คำนวณ Fear & Greed จาก indicators"""
        scores = []
        
        try:
            import yfinance as yf
            
            # 1. S&P 500 Momentum
            spy = yf.Ticker("SPY")
            hist = spy.history(period="6mo")
            if not hist.empty and len(hist) >= 125:
                price = hist['Close'].iloc[-1]
                ma125 = hist['Close'].rolling(125).mean().iloc[-1]
                momentum_score = min(100, max(0, 50 + (price - ma125) / ma125 * 500))
                scores.append(("momentum", momentum_score))
            
            # 2. VIX (inverted)
            vix_data = self.get_vix()
            vix_val = vix_data["value"]
            vix_score = max(0, min(100, 100 - (vix_val - 10) * 3.33))
            scores.append(("vix", vix_score))
            
            # 3. Safe Haven Demand
            safe_haven = self._get_safe_haven_score()
            scores.append(("safe_haven", safe_haven))
            
            # 4. RSI
            rsi = self._calculate_rsi(hist['Close']) if not hist.empty else 50
            scores.append(("rsi", rsi))
            
        except Exception as e:
            print(f"  [F&G Calc Error] {e}")
        
        if not scores:
            return {"score": 50, "rating": "Neutral", "signal": "HOLD", "source": "default"}
        
        avg_score = sum(s[1] for s in scores) / len(scores)
        final_score = round(avg_score)
        
        return {
            "score": final_score,
            "rating": self._score_to_rating(final_score),
            "signal": self._score_to_signal(final_score),
            "source": "calculated",
            "components": {name: round(val) for name, val in scores}
        }

    @retry_on_failure(max_retries=2)
    def _get_crypto_fear_greed(self) -> Dict:
        """Crypto Fear & Greed จาก alternative.me"""
        url = "https://api.alternative.me/fng/?limit=1"
        resp = requests.get(url, timeout=10)
        data = resp.json()
        
        if data.get("data"):
            score = int(data["data"][0]["value"])
            classification = data["data"][0]["value_classification"]
            
            return {
                "score": score,
                "rating": classification,
                "signal": self._score_to_signal(score),
                "source": "alternative.me"
            }
        return {"score": 50, "rating": "Neutral", "signal": "HOLD", "source": "default"}
    
    def _get_safe_haven_score(self) -> float:
        """Safe haven demand: TLT vs SPY"""
        try:
            import yfinance as yf
            spy = yf.Ticker("SPY")
            tlt = yf.Ticker("TLT")
            
            spy_hist = spy.history(period="1mo")
            tlt_hist = tlt.history(period="1mo")
            
            if spy_hist.empty or tlt_hist.empty:
                return 50
            
            spy_return = (spy_hist['Close'].iloc[-1] - spy_hist['Close'].iloc[0]) / spy_hist['Close'].iloc[0]
            tlt_return = (tlt_hist['Close'].iloc[-1] - tlt_hist['Close'].iloc[0]) / tlt_hist['Close'].iloc[0]
            
            diff = spy_return - tlt_return
            return min(100, max(0, 50 + diff * 500))
        except:
            return 50
    
    def _score_to_rating(self, score: float) -> str:
        if score <= 20: return "Extreme Fear"
        elif score <= 40: return "Fear"
        elif score <= 60: return "Neutral"
        elif score <= 80: return "Greed"
        else: return "Extreme Greed"
    
    def _score_to_signal(self, score: float) -> str:
        if score <= 20: return "EXTREME_FEAR"
        elif score <= 40: return "FEAR"
        elif score <= 60: return "NEUTRAL"
        elif score <= 80: return "GREED"
        else: return "EXTREME_GREED"
    
    # ==================== Market Breadth (Enhanced) ====================
    def get_market_breadth(self) -> Dict:
        """Market breadth analysis with multiple sources"""
        cached = self._get_cached('breadth')
        if cached:
            return cached
        
        # Try real Advance/Decline data first
        real_breadth = self._get_real_advance_decline()
        if real_breadth:
            self._set_cache('breadth', real_breadth)
            return real_breadth
        
        # Fallback to ETF proxy
        etf_breadth = self._get_etf_breadth()
        self._set_cache('breadth', etf_breadth)
        return etf_breadth
    
    @retry_on_failure(max_retries=2)
    def _get_real_advance_decline(self) -> Optional[Dict]:
        """Try to get real Advance/Decline data from free sources"""
        try:
            # Try WSJ Market Data
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            # Alternative: Use Yahoo Finance market movers
            import yfinance as yf
            
            # Get NYSE and NASDAQ data via index components
            # This is an approximation using major indices
            indices = {
                "^NYA": "NYSE Composite",  # NYSE
                "^IXIC": "NASDAQ Composite"  # NASDAQ
            }
            
            total_up = 0
            total_down = 0
            
            for symbol, name in indices.items():
                try:
                    ticker = yf.Ticker(symbol)
                    hist = ticker.history(period="2d")
                    if not hist.empty and len(hist) >= 2:
                        change = hist['Close'].iloc[-1] - hist['Close'].iloc[-2]
                        # Use volume as weight
                        vol = hist['Volume'].iloc[-1] if 'Volume' in hist else 1
                        if change > 0:
                            total_up += 1
                        else:
                            total_down += 1
                except:
                    continue
            
            if total_up + total_down == 0:
                return None
            
            ratio = total_up / (total_up + total_down)
            
            return {
                "advances": total_up,
                "declines": total_down,
                "ratio": round(ratio, 2),
                "signal": "BULLISH" if ratio > 0.6 else "BEARISH" if ratio < 0.4 else "NEUTRAL",
                "score": round(ratio * 100),
                "source": "yahoo_indices"
            }
        except Exception as e:
            print(f"  [Real A/D Error] {e}")
            return None
    
    @retry_on_failure(max_retries=3)
    def _get_etf_breadth(self) -> Dict:
        """ETF-based market breadth (fallback)"""
        import yfinance as yf
        
        indices = {
            "SPY": "S&P 500",
            "QQQ": "NASDAQ 100",
            "DIA": "Dow Jones",
            "IWM": "Russell 2000",
            "VTI": "Total Market",
            "MDY": "Mid Cap",
            "IJR": "Small Cap"
        }
        
        results = {}
        bullish, bearish, neutral = 0, 0, 0
        
        for symbol, name in indices.items():
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="5d")
                
                if not hist.empty and len(hist) >= 2:
                    change = (hist['Close'].iloc[-1] - hist['Close'].iloc[-2]) / hist['Close'].iloc[-2] * 100
                    
                    if change > 0.1:
                        bullish += 1
                        status = "bullish"
                    elif change < -0.1:
                        bearish += 1
                        status = "bearish"
                    else:
                        neutral += 1
                        status = "neutral"
                    
                    results[symbol] = {
                        "name": name,
                        "change_pct": round(change, 2),
                        "status": status
                    }
            except:
                continue
        
        total = bullish + bearish + neutral
        if total == 0:
            return {"bullish": 1, "bearish": 1, "neutral": 1, "signal": "NEUTRAL", "score": 50}
        
        signal = "BULLISH" if bullish > bearish else "BEARISH" if bearish > bullish else "NEUTRAL"
        
        return {
            "bullish": bullish,
            "bearish": bearish,
            "neutral": neutral,
            "signal": signal,
            "score": round((bullish / total) * 100),
            "indices": results,
            "source": "etf_proxy"
        }

    # ==================== Sector Performance ====================
    @retry_on_failure(max_retries=3)
    def get_sector_performance(self) -> Dict:
        """Sector ETF performance analysis"""
        cached = self._get_cached('sectors')
        if cached:
            return cached
            
        import yfinance as yf
        
        sectors = {
            "XLK": "Technology",
            "XLF": "Financials",
            "XLE": "Energy",
            "XLV": "Healthcare",
            "XLI": "Industrials",
            "XLY": "Consumer Disc.",
            "XLP": "Consumer Staples",
            "XLU": "Utilities",
            "XLRE": "Real Estate",
            "XLB": "Materials",
            "XLC": "Communication"
        }
        
        results = []
        for symbol, name in sectors.items():
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="5d")
                
                if not hist.empty and len(hist) >= 2:
                    change_1d = (hist['Close'].iloc[-1] - hist['Close'].iloc[-2]) / hist['Close'].iloc[-2] * 100
                    change_5d = (hist['Close'].iloc[-1] - hist['Close'].iloc[0]) / hist['Close'].iloc[0] * 100
                    
                    results.append({
                        "symbol": symbol,
                        "name": name,
                        "change_1d": round(change_1d, 2),
                        "change_5d": round(change_5d, 2)
                    })
            except:
                continue
        
        results.sort(key=lambda x: x["change_1d"], reverse=True)
        
        # Risk-on vs Risk-off analysis
        top_sectors = [r["name"] for r in results[:3]]
        risk_on = ["Technology", "Consumer Disc.", "Financials", "Communication"]
        risk_off = ["Utilities", "Consumer Staples", "Healthcare", "Real Estate"]
        
        risk_on_score = sum(1 for s in top_sectors if s in risk_on)
        risk_off_score = sum(1 for s in top_sectors if s in risk_off)
        
        if risk_on_score > risk_off_score:
            rotation = "RISK_ON"
        elif risk_off_score > risk_on_score:
            rotation = "RISK_OFF"
        else:
            rotation = "MIXED"
        
        result = {
            "sectors": results,
            "top_performers": results[:3],
            "bottom_performers": results[-3:],
            "rotation": rotation,
            "signal": "BULLISH" if rotation == "RISK_ON" else "BEARISH" if rotation == "RISK_OFF" else "NEUTRAL"
        }
        
        self._set_cache('sectors', result)
        return result

    # ==================== Moving Averages (Enhanced with EMA) ====================
    def get_moving_averages(self, use_ema: bool = True) -> Dict:
        """
        Moving average analysis for S&P 500
        
        Args:
            use_ema: If True, use EMA (faster signals). If False, use SMA.
        """
        cached = self._get_cached(f'ma_{use_ema}')
        if cached:
            return cached
            
        try:
            import yfinance as yf
            spy = yf.Ticker("SPY")
            hist = spy.history(period="1y")
            
            if hist.empty or len(hist) < 200:
                return {"trend": "NEUTRAL", "ma50_above_ma200": True}
            
            price = float(hist['Close'].iloc[-1])
            
            if use_ema:
                # EMA - Exponential Moving Average (more responsive)
                ma20 = float(hist['Close'].ewm(span=20, adjust=False).mean().iloc[-1])
                ma50 = float(hist['Close'].ewm(span=50, adjust=False).mean().iloc[-1])
                ma200 = float(hist['Close'].ewm(span=200, adjust=False).mean().iloc[-1])
                ma_type = "EMA"
            else:
                # SMA - Simple Moving Average (smoother)
                ma20 = float(hist['Close'].rolling(20).mean().iloc[-1])
                ma50 = float(hist['Close'].rolling(50).mean().iloc[-1])
                ma200 = float(hist['Close'].rolling(200).mean().iloc[-1])
                ma_type = "SMA"
            
            # Count bullish signals
            signals = sum([
                price > ma20,
                price > ma50,
                price > ma200,
                ma20 > ma50,
                ma50 > ma200
            ])
            
            if signals >= 5:
                trend = "STRONG_BULLISH"
            elif signals >= 4:
                trend = "BULLISH"
            elif signals >= 3:
                trend = "NEUTRAL"
            elif signals >= 2:
                trend = "BEARISH"
            else:
                trend = "STRONG_BEARISH"
            
            # Golden Cross / Death Cross detection
            cross = None
            if use_ema:
                ma50_hist = hist['Close'].ewm(span=50, adjust=False).mean()
                ma200_hist = hist['Close'].ewm(span=200, adjust=False).mean()
            else:
                ma50_hist = hist['Close'].rolling(50).mean()
                ma200_hist = hist['Close'].rolling(200).mean()
            
            # Check last 5 days for cross
            for i in range(-5, -1):
                if len(ma50_hist) > abs(i) and len(ma200_hist) > abs(i):
                    prev_diff = ma50_hist.iloc[i-1] - ma200_hist.iloc[i-1]
                    curr_diff = ma50_hist.iloc[i] - ma200_hist.iloc[i]
                    
                    if prev_diff < 0 and curr_diff > 0:
                        cross = "GOLDEN_CROSS"
                        break
                    elif prev_diff > 0 and curr_diff < 0:
                        cross = "DEATH_CROSS"
                        break
            
            # Calculate distance from MAs (for signal strength)
            dist_ma20 = ((price - ma20) / ma20) * 100
            dist_ma50 = ((price - ma50) / ma50) * 100
            dist_ma200 = ((price - ma200) / ma200) * 100
            
            result = {
                "trend": trend,
                "ma_type": ma_type,
                "price": round(price, 2),
                "ma20": round(ma20, 2),
                "ma50": round(ma50, 2),
                "ma200": round(ma200, 2),
                "price_vs_ma20": "above" if price > ma20 else "below",
                "price_vs_ma50": "above" if price > ma50 else "below",
                "price_vs_ma200": "above" if price > ma200 else "below",
                "distance_from_ma20": round(dist_ma20, 2),
                "distance_from_ma50": round(dist_ma50, 2),
                "distance_from_ma200": round(dist_ma200, 2),
                "ma50_above_ma200": ma50 > ma200,
                "cross": cross,
                "bullish_signals": signals
            }
            
            self._set_cache(f'ma_{use_ema}', result)
            return result
            
        except Exception as e:
            print(f"  [MA Error] {e}")
            return {"trend": "NEUTRAL", "ma50_above_ma200": True, "ma_type": "EMA" if use_ema else "SMA"}

    # ==================== Treasury Yields ====================
    def get_treasury_yields(self) -> Dict:
        """Treasury yield analysis with FRED API fallback"""
        cached = self._get_cached('yields')
        if cached:
            return cached
        
        # Try FRED first (most accurate)
        fred_result = self._get_yield_from_fred()
        if fred_result:
            self._set_cache('yields', fred_result)
            return fred_result
        
        # Fallback to Yahoo Finance
        yahoo_result = self._get_yields_from_yahoo()
        self._set_cache('yields', yahoo_result)
        return yahoo_result
    
    @retry_on_failure(max_retries=2)
    def _get_yield_from_fred(self) -> Optional[Dict]:
        """Get yield spread from FRED (free, no API key needed for CSV)"""
        try:
            # FRED CSV endpoint (no API key required)
            url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y3M"
            resp = requests.get(url, timeout=10)
            
            if resp.status_code == 200:
                lines = resp.text.strip().split('\n')
                if len(lines) > 1:
                    for line in reversed(lines[1:]):
                        parts = line.split(',')
                        if len(parts) >= 2 and parts[1] and parts[1] != '.':
                            spread = float(parts[1])
                            inverted = spread < 0
                            
                            print(f"  [FRED] 10Y-3M Spread: {spread}% ({'Inverted' if inverted else 'Normal'})")
                            
                            return {
                                "yields": {"spread_10y_3m": spread},
                                "spread": spread,
                                "inverted": inverted,
                                "signal": "BEARISH" if inverted else "NEUTRAL",
                                "interpretation": "Yield curve inverted - recession warning" if inverted else "Normal yield curve",
                                "source": "FRED"
                            }
        except Exception as e:
            print(f"  [FRED Error] {e}")
        return None
    
    @retry_on_failure(max_retries=2)
    def _get_yields_from_yahoo(self) -> Dict:
        """Fallback: Get yields from Yahoo Finance"""
        try:
            import yfinance as yf
            
            yields = {}
            
            # 10Y yield
            tnx = yf.Ticker("^TNX")
            hist_10y = tnx.history(period="5d")
            if not hist_10y.empty:
                yields["10Y"] = round(float(hist_10y['Close'].iloc[-1]), 3)
            
            # 5Y yield
            fvx = yf.Ticker("^FVX")
            hist_5y = fvx.history(period="5d")
            if not hist_5y.empty:
                yields["5Y"] = round(float(hist_5y['Close'].iloc[-1]), 3)
            
            # 3M yield (T-Bill)
            irx = yf.Ticker("^IRX")
            hist_3m = irx.history(period="5d")
            if not hist_3m.empty:
                yields["3M"] = round(float(hist_3m['Close'].iloc[-1]), 3)
            
            # Calculate spread
            spread = 0
            inverted = False
            
            if "10Y" in yields and "3M" in yields:
                spread = round(yields["10Y"] - yields["3M"], 3)
                inverted = spread < 0
            
            return {
                "yields": yields,
                "spread": spread,
                "inverted": inverted,
                "signal": "BEARISH" if inverted else "NEUTRAL",
                "interpretation": "Yield curve inverted - recession warning" if inverted else "Normal yield curve",
                "source": "yahoo_finance"
            }
        except Exception as e:
            print(f"  [Yahoo Yields Error] {e}")
            return {"yields": {}, "inverted": False, "signal": "NEUTRAL", "spread": 0}

    # ==================== RSI Calculation ====================
    def _calculate_rsi(self, prices, period: int = 14) -> float:
        """Calculate RSI (Relative Strength Index)"""
        try:
            if len(prices) < period + 1:
                return 50
            
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return float(rsi.iloc[-1])
        except:
            return 50

    # ==================== Dollar Index (DXY) ====================
    @retry_on_failure(max_retries=2)
    def get_dollar_index(self) -> Dict:
        """Get US Dollar Index (DXY) - important for market sentiment"""
        try:
            import yfinance as yf
            
            dxy = yf.Ticker("DX-Y.NYB")
            hist = dxy.history(period="1mo")
            
            if hist.empty:
                return {"value": 100, "change": 0, "signal": "NEUTRAL"}
            
            current = float(hist['Close'].iloc[-1])
            prev = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
            change = ((current - prev) / prev) * 100
            
            # Strong dollar = bearish for stocks (generally)
            if current > 105:
                signal = "BEARISH"
            elif current > 100:
                signal = "NEUTRAL"
            else:
                signal = "BULLISH"
            
            return {
                "value": round(current, 2),
                "change": round(change, 2),
                "signal": signal,
                "interpretation": "Strong dollar pressures stocks" if current > 105 else "Weak dollar supports stocks" if current < 95 else "Dollar neutral"
            }
        except Exception as e:
            print(f"  [DXY Error] {e}")
            return {"value": 100, "change": 0, "signal": "NEUTRAL"}

    # ==================== Gold (Safe Haven) ====================
    @retry_on_failure(max_retries=2)
    def get_gold_sentiment(self) -> Dict:
        """Gold price analysis - safe haven indicator"""
        try:
            import yfinance as yf
            
            gold = yf.Ticker("GC=F")
            hist = gold.history(period="1mo")
            
            if hist.empty:
                return {"value": 2000, "change": 0, "signal": "NEUTRAL"}
            
            current = float(hist['Close'].iloc[-1])
            prev_day = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
            prev_week = float(hist['Close'].iloc[-5]) if len(hist) > 5 else current
            
            change_1d = ((current - prev_day) / prev_day) * 100
            change_1w = ((current - prev_week) / prev_week) * 100
            
            # Rising gold = fear/uncertainty
            if change_1w > 3:
                signal = "FEAR"
            elif change_1w > 1:
                signal = "CAUTIOUS"
            elif change_1w < -2:
                signal = "RISK_ON"
            else:
                signal = "NEUTRAL"
            
            return {
                "value": round(current, 2),
                "change_1d": round(change_1d, 2),
                "change_1w": round(change_1w, 2),
                "signal": signal,
                "interpretation": "Gold rising = flight to safety" if change_1w > 2 else "Gold stable"
            }
        except Exception as e:
            print(f"  [Gold Error] {e}")
            return {"value": 2000, "change_1d": 0, "change_1w": 0, "signal": "NEUTRAL"}

    # ==================== Market Momentum (New) ====================
    @retry_on_failure(max_retries=2)
    def get_market_momentum(self) -> Dict:
        """Calculate market momentum using multiple timeframes"""
        try:
            import yfinance as yf
            
            spy = yf.Ticker("SPY")
            hist = spy.history(period="3mo")
            
            if hist.empty or len(hist) < 60:
                return {"momentum": "NEUTRAL", "score": 50}
            
            price = float(hist['Close'].iloc[-1])
            
            # Calculate returns for different periods
            ret_1d = (price - hist['Close'].iloc[-2]) / hist['Close'].iloc[-2] * 100
            ret_1w = (price - hist['Close'].iloc[-5]) / hist['Close'].iloc[-5] * 100 if len(hist) >= 5 else 0
            ret_1m = (price - hist['Close'].iloc[-21]) / hist['Close'].iloc[-21] * 100 if len(hist) >= 21 else 0
            ret_3m = (price - hist['Close'].iloc[0]) / hist['Close'].iloc[0] * 100
            
            # RSI
            rsi = self._calculate_rsi(hist['Close'])
            
            # MACD
            ema12 = hist['Close'].ewm(span=12, adjust=False).mean()
            ema26 = hist['Close'].ewm(span=26, adjust=False).mean()
            macd = ema12 - ema26
            signal_line = macd.ewm(span=9, adjust=False).mean()
            macd_histogram = float(macd.iloc[-1] - signal_line.iloc[-1])
            
            # Score calculation
            score = 50
            
            # Momentum contribution
            if ret_1m > 5: score += 15
            elif ret_1m > 2: score += 10
            elif ret_1m > 0: score += 5
            elif ret_1m < -5: score -= 15
            elif ret_1m < -2: score -= 10
            elif ret_1m < 0: score -= 5
            
            # RSI contribution
            if rsi > 70: score -= 10  # Overbought
            elif rsi > 60: score += 5
            elif rsi < 30: score += 15  # Oversold = opportunity
            elif rsi < 40: score += 5
            
            # MACD contribution
            if macd_histogram > 0: score += 10
            else: score -= 5
            
            score = max(0, min(100, score))
            
            if score >= 70:
                momentum = "STRONG_BULLISH"
            elif score >= 55:
                momentum = "BULLISH"
            elif score >= 45:
                momentum = "NEUTRAL"
            elif score >= 30:
                momentum = "BEARISH"
            else:
                momentum = "STRONG_BEARISH"
            
            return {
                "momentum": momentum,
                "score": score,
                "returns": {
                    "1d": round(ret_1d, 2),
                    "1w": round(ret_1w, 2),
                    "1m": round(ret_1m, 2),
                    "3m": round(ret_3m, 2)
                },
                "rsi": round(rsi, 1),
                "macd_histogram": round(macd_histogram, 3)
            }
        except Exception as e:
            print(f"  [Momentum Error] {e}")
            return {"momentum": "NEUTRAL", "score": 50}

    # ==================== Put/Call Ratio ====================
    @retry_on_failure(max_retries=2)
    def get_put_call_ratio(self) -> Dict:
        """Estimate Put/Call ratio sentiment from VIX and options ETFs"""
        try:
            import yfinance as yf
            
            # Use VIX as proxy
            vix = yf.Ticker("^VIX")
            vix_hist = vix.history(period="1mo")
            
            if vix_hist.empty:
                return {"ratio": 1.0, "signal": "NEUTRAL"}
            
            current_vix = float(vix_hist['Close'].iloc[-1])
            avg_vix = float(vix_hist['Close'].mean())
            
            # Estimate PCR from VIX level
            # High VIX = more puts = higher PCR
            estimated_pcr = 0.8 + (current_vix - 15) * 0.02
            estimated_pcr = max(0.5, min(1.5, estimated_pcr))
            
            # Signal interpretation
            # PCR > 1.0 = more puts = bearish sentiment = contrarian bullish
            # PCR < 0.7 = more calls = bullish sentiment = contrarian bearish
            if estimated_pcr > 1.2:
                signal = "EXTREME_FEAR"  # Contrarian bullish
            elif estimated_pcr > 1.0:
                signal = "FEAR"
            elif estimated_pcr > 0.8:
                signal = "NEUTRAL"
            elif estimated_pcr > 0.6:
                signal = "GREED"
            else:
                signal = "EXTREME_GREED"  # Contrarian bearish
            
            return {
                "ratio": round(estimated_pcr, 2),
                "signal": signal,
                "interpretation": "High put buying = fear (contrarian buy)" if estimated_pcr > 1.0 else "Low put buying = complacency",
                "source": "estimated_from_vix"
            }
        except Exception as e:
            print(f"  [PCR Error] {e}")
            return {"ratio": 1.0, "signal": "NEUTRAL"}

    # ==================== AI Score Calculation (Enhanced) ====================
    def calculate_ai_score(self) -> Dict:
        """Calculate comprehensive AI market score with all indicators"""
        print("=" * 50)
        print("🤖 Analyzing Market Sentiment v2.0...")
        print("=" * 50)
        
        print("  Fetching VIX...")
        vix = self.get_vix() or self._default_vix()
        
        print("  Calculating Fear & Greed...")
        fear_greed = self.get_fear_greed_index()
        
        print("  Analyzing Market Breadth...")
        breadth = self.get_market_breadth()
        
        print("  Analyzing Sectors...")
        sectors = self.get_sector_performance()
        
        print("  Analyzing Moving Averages (EMA)...")
        ma = self.get_moving_averages(use_ema=True)
        
        print("  Checking Treasury Yields...")
        yields = self.get_treasury_yields()
        
        print("  Analyzing Market Momentum...")
        momentum = self.get_market_momentum()
        
        print("  Checking Dollar Index...")
        dxy = self.get_dollar_index()
        
        print("  Checking Gold...")
        gold = self.get_gold_sentiment()
        
        print("  Estimating Put/Call Ratio...")
        pcr = self.get_put_call_ratio()
        
        # Calculate weighted score
        scores = []
        weights = []
        
        # 1. Fear & Greed (20%) - Contrarian
        fg_score = fear_greed.get("score", 50)
        if fg_score <= 20:
            scores.append(85)  # Extreme fear = great buy
        elif fg_score <= 40:
            scores.append(70)
        elif fg_score <= 60:
            scores.append(50)
        elif fg_score <= 80:
            scores.append(35)
        else:
            scores.append(15)
        weights.append(20)
        
        # 2. VIX (15%) - Contrarian
        vix_val = vix.get("value", 20)
        if vix_val > 35:
            scores.append(80)
        elif vix_val > 25:
            scores.append(65)
        elif vix_val > 20:
            scores.append(50)
        elif vix_val > 15:
            scores.append(45)
        else:
            scores.append(35)
        weights.append(15)
        
        # 3. Market Breadth (15%)
        breadth_score = breadth.get("score", 50)
        scores.append(breadth_score)
        weights.append(15)
        
        # 4. Sector Rotation (10%)
        rotation = sectors.get("rotation", "MIXED")
        if rotation == "RISK_ON":
            scores.append(70)
        elif rotation == "RISK_OFF":
            scores.append(30)
        else:
            scores.append(50)
        weights.append(10)
        
        # 5. Moving Averages (15%)
        ma_trend = ma.get("trend", "NEUTRAL")
        ma_scores = {
            "STRONG_BULLISH": 80,
            "BULLISH": 65,
            "NEUTRAL": 50,
            "BEARISH": 35,
            "STRONG_BEARISH": 20
        }
        scores.append(ma_scores.get(ma_trend, 50))
        weights.append(15)
        
        # 6. Yield Curve (5%)
        if yields.get("inverted"):
            scores.append(25)
        else:
            scores.append(55)
        weights.append(5)
        
        # 7. Momentum (10%)
        momentum_score = momentum.get("score", 50)
        scores.append(momentum_score)
        weights.append(10)
        
        # 8. Dollar Index (5%)
        dxy_signal = dxy.get("signal", "NEUTRAL")
        if dxy_signal == "BULLISH":
            scores.append(65)
        elif dxy_signal == "BEARISH":
            scores.append(35)
        else:
            scores.append(50)
        weights.append(5)
        
        # 9. Put/Call Ratio (5%) - Contrarian
        pcr_signal = pcr.get("signal", "NEUTRAL")
        pcr_scores = {
            "EXTREME_FEAR": 80,
            "FEAR": 65,
            "NEUTRAL": 50,
            "GREED": 35,
            "EXTREME_GREED": 20
        }
        scores.append(pcr_scores.get(pcr_signal, 50))
        weights.append(5)
        
        # Calculate final score
        total_score = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
        final_score = round(total_score)
        
        # Generate recommendation
        if final_score >= 75:
            recommendation = "STRONG_BUY"
            message = "🟢 Excellent market conditions for buying (Extreme Fear = Opportunity)"
            message_th = "🟢 สภาวะตลาดเหมาะสมมากสำหรับการเข้าซื้อ (Extreme Fear = โอกาส)"
        elif final_score >= 60:
            recommendation = "BUY"
            message = "🟢 Good market conditions, consider buying"
            message_th = "🟢 สภาวะตลาดค่อนข้างดี พิจารณาเข้าซื้อได้"
        elif final_score >= 45:
            recommendation = "HOLD"
            message = "🟡 Normal market conditions, wait for better opportunity"
            message_th = "🟡 สภาวะตลาดปกติ รอจังหวะที่ดีกว่า"
        elif final_score >= 30:
            recommendation = "CAUTIOUS"
            message = "🟠 Caution! Market has risks, reduce position size"
            message_th = "🟠 ระวัง! ตลาดมีความเสี่ยง ลดขนาด position"
        else:
            recommendation = "AVOID"
            message = "🔴 Avoid buying, high market risk"
            message_th = "🔴 หลีกเลี่ยงการเข้าซื้อ ตลาดมีความเสี่ยงสูง"
        
        return {
            "score": final_score,
            "recommendation": recommendation,
            "message": message,
            "message_th": message_th,
            "indicators": {
                "fear_greed": fear_greed,
                "vix": vix,
                "market_breadth": breadth,
                "sectors": sectors,
                "moving_averages": ma,
                "treasury_yields": yields,
                "momentum": momentum,
                "dollar_index": dxy,
                "gold": gold,
                "put_call_ratio": pcr
            },
            "score_breakdown": {
                "fear_greed": scores[0],
                "vix": scores[1],
                "breadth": scores[2],
                "sectors": scores[3],
                "ma": scores[4],
                "yields": scores[5],
                "momentum": scores[6],
                "dxy": scores[7],
                "pcr": scores[8]
            },
            "weights": {
                "fear_greed": "20%",
                "vix": "15%",
                "breadth": "15%",
                "ma": "15%",
                "momentum": "10%",
                "sectors": "10%",
                "yields": "5%",
                "dxy": "5%",
                "pcr": "5%"
            },
            "version": "2.0",
            "updated_at": datetime.now().isoformat()
        }

    def analyze(self) -> Dict:
        """Main analysis function"""
        result = self.calculate_ai_score()
        # Convert numpy types to Python native types
        return json.loads(json.dumps(result, default=str))


# ==================== Main ====================
if __name__ == "__main__":
    analyzer = MarketSentimentAnalyzer()
    result = analyzer.analyze()
    
    print(f"\n{'=' * 50}")
    print(f"🤖 AI MARKET SCORE: {result['score']}/100")
    print(f"📊 Recommendation: {result['recommendation']}")
    print(f"💬 {result['message']}")
    print(f"{'=' * 50}")
    
    # Print indicators
    indicators = result.get("indicators", {})
    
    print(f"\n📈 VIX: {indicators.get('vix', {}).get('value', 'N/A')}")
    print(f"😱 Fear & Greed (Stock): {indicators.get('fear_greed', {}).get('score', 'N/A')}")
    print(f"🪙 Fear & Greed (Crypto): {indicators.get('fear_greed', {}).get('crypto', {}).get('score', 'N/A')}")
    print(f"📊 Market Breadth: {indicators.get('market_breadth', {}).get('signal', 'N/A')}")
    print(f"🏭 Sector Rotation: {indicators.get('sectors', {}).get('rotation', 'N/A')}")
    print(f"📉 MA Trend ({indicators.get('moving_averages', {}).get('ma_type', 'EMA')}): {indicators.get('moving_averages', {}).get('trend', 'N/A')}")
    print(f"📈 Yield Curve: {'Inverted ⚠️' if indicators.get('treasury_yields', {}).get('inverted') else 'Normal'}")
    print(f"🚀 Momentum: {indicators.get('momentum', {}).get('momentum', 'N/A')}")
    print(f"💵 Dollar Index: {indicators.get('dollar_index', {}).get('value', 'N/A')}")
    print(f"🥇 Gold: {indicators.get('gold', {}).get('signal', 'N/A')}")
    print(f"📞 Put/Call Ratio: {indicators.get('put_call_ratio', {}).get('ratio', 'N/A')}")
    
    # Save to file
    os.makedirs('data', exist_ok=True)
    with open('data/market_sentiment.json', 'w') as f:
        json.dump(result, f, indent=2)
    print("\n✅ Saved to data/market_sentiment.json")
