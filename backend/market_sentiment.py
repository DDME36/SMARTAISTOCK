"""
Market Sentiment Analyzer - Enhanced Version
วิเคราะห์ Fear & Greed Index (CNN), VIX, และดัชนีต่างๆ เพื่อประเมินความน่าเข้าลงทุน

Data Sources:
- VIX: Yahoo Finance (^VIX) - Real-time
- Fear & Greed (Stock): CNN scraping / calculated
- Fear & Greed (Crypto): alternative.me API
- Market Breadth: SPY, QQQ, DIA, IWM
- Put/Call Ratio: CBOE data
- Sector Performance: XLK, XLF, XLE, etc.
"""
import requests
import json
from datetime import datetime
from typing import Dict, Optional
import os

class MarketSentimentAnalyzer:
    def __init__(self):
        self.data = {}
        self.cache = {}
    
    # ==================== VIX (CBOE Volatility Index) ====================
    def get_vix(self) -> Dict:
        """ดึง VIX จาก Yahoo Finance - แม่นยำและ real-time"""
        try:
            import yfinance as yf
            vix = yf.Ticker("^VIX")
            hist = vix.history(period="5d")
            
            if hist.empty:
                return self._default_vix()
            
            current = float(hist['Close'].iloc[-1])
            prev = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
            change = ((current - prev) / prev) * 100
            
            # VIX Interpretation
            # < 12: Extreme Complacency (rare)
            # 12-17: Low volatility, bullish
            # 17-20: Normal
            # 20-25: Elevated concern
            # 25-30: High fear
            # > 30: Extreme fear / panic
            
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
            
            return {
                "value": round(current, 2),
                "change": round(change, 2),
                "change_pct": round(change, 2),
                "signal": signal,
                "level": level,
                "trend": "up" if change > 0 else "down" if change < 0 else "flat",
                "source": "yahoo_finance",
                "interpretation": self._interpret_vix(current)
            }
        except Exception as e:
            print(f"  [VIX Error] {e}")
            return self._default_vix()
    
    def _default_vix(self) -> Dict:
        return {"value": 20, "change": 0, "signal": "NEUTRAL", "level": "normal", "trend": "flat", "source": "default"}
    
    def _interpret_vix(self, vix: float) -> str:
        if vix < 15: return "ตลาดสงบ นักลงทุนมั่นใจ"
        elif vix < 20: return "ความผันผวนปกติ"
        elif vix < 25: return "ความกังวลเพิ่มขึ้น"
        elif vix < 30: return "ความกลัวสูง ระวังการลงทุน"
        else: return "ตลาดตื่นตระหนก! รอจังหวะ"

    # ==================== Fear & Greed Index ====================
    def get_fear_greed_index(self) -> Dict:
        """
        ดึง Fear & Greed Index
        - Stock Market: คำนวณจาก indicators หลายตัว (เลียนแบบ CNN)
        - Crypto: alternative.me API (ฟรี)
        """
        # Try CNN-style calculation first (for stocks)
        stock_fg = self._calculate_stock_fear_greed()
        
        # Also get crypto F&G for reference
        crypto_fg = self._get_crypto_fear_greed()
        
        return {
            "stock": stock_fg,
            "crypto": crypto_fg,
            # Use stock F&G as primary
            "score": stock_fg["score"],
            "rating": stock_fg["rating"],
            "signal": stock_fg["signal"],
            "source": stock_fg["source"]
        }
    
    def _calculate_stock_fear_greed(self) -> Dict:
        """
        ดึง Fear & Greed Index จาก CNN โดยตรง
        ถ้าไม่ได้จะ fallback ไปคำนวณเอง
        """
        # Try CNN direct API first
        cnn_data = self._get_cnn_fear_greed()
        if cnn_data:
            return cnn_data
        
        # Fallback: Calculate from indicators
        return self._calculate_fear_greed_fallback()
    
    def _get_cnn_fear_greed(self) -> Dict:
        """ดึง Fear & Greed Index จาก CNN API โดยตรง"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
                    "previous_1_month": fg.get('previous_1_month'),
                    "timestamp": fg.get('timestamp')
                }
        except Exception as e:
            print(f"  [CNN F&G Error] {e}")
        
        return None
    
    def _calculate_fear_greed_fallback(self) -> Dict:
        """Fallback: คำนวณ Fear & Greed จาก indicators"""
        scores = []
        
        try:
            import yfinance as yf
            
            # 1. S&P 500 Momentum (Price vs 125-day MA)
            spy = yf.Ticker("SPY")
            hist = spy.history(period="6mo")
            if not hist.empty and len(hist) >= 125:
                price = hist['Close'].iloc[-1]
                ma125 = hist['Close'].rolling(125).mean().iloc[-1]
                momentum_score = min(100, max(0, 50 + (price - ma125) / ma125 * 500))
                scores.append(("momentum", momentum_score))
            
            # 2. Market Breadth (Advance/Decline)
            breadth = self._get_market_breadth_score()
            scores.append(("breadth", breadth))
            
            # 3. VIX (inverted - low VIX = high score)
            vix_data = self.get_vix()
            vix_val = vix_data["value"]
            vix_score = max(0, min(100, 100 - (vix_val - 10) * 3.33))
            scores.append(("vix", vix_score))
            
            # 4. Put/Call Ratio (estimated)
            pcr_score = self._get_put_call_score()
            scores.append(("put_call", pcr_score))
            
            # 5. Safe Haven Demand
            safe_haven = self._get_safe_haven_score()
            scores.append(("safe_haven", safe_haven))
            
            # 6. Junk Bond Demand
            junk_score = self._get_junk_bond_score()
            scores.append(("junk_bond", junk_score))
            
            # 7. RSI of S&P 500
            rsi = self._get_spy_rsi()
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

    def _get_market_breadth_score(self) -> float:
        """Market breadth from major indices"""
        try:
            import yfinance as yf
            symbols = ["SPY", "QQQ", "DIA", "IWM", "VTI"]
            up, down = 0, 0
            
            for sym in symbols:
                ticker = yf.Ticker(sym)
                hist = ticker.history(period="5d")
                if not hist.empty and len(hist) >= 2:
                    change = (hist['Close'].iloc[-1] - hist['Close'].iloc[-2]) / hist['Close'].iloc[-2]
                    if change > 0.001: up += 1
                    elif change < -0.001: down += 1
            
            total = up + down
            if total == 0: return 50
            return (up / total) * 100
        except:
            return 50
    
    def _get_put_call_score(self) -> float:
        """Estimate Put/Call ratio sentiment"""
        try:
            import yfinance as yf
            # Use VIX as proxy for options sentiment
            vix = yf.Ticker("^VIX")
            hist = vix.history(period="1mo")
            if hist.empty: return 50
            
            current = hist['Close'].iloc[-1]
            avg = hist['Close'].mean()
            
            # If VIX below average = bullish (high score)
            if current < avg * 0.8: return 75
            elif current < avg: return 60
            elif current < avg * 1.2: return 40
            else: return 25
        except:
            return 50
    
    def _get_safe_haven_score(self) -> float:
        """Safe haven demand: TLT (bonds) vs SPY (stocks)"""
        try:
            import yfinance as yf
            spy = yf.Ticker("SPY")
            tlt = yf.Ticker("TLT")
            
            spy_hist = spy.history(period="1mo")
            tlt_hist = tlt.history(period="1mo")
            
            if spy_hist.empty or tlt_hist.empty: return 50
            
            spy_return = (spy_hist['Close'].iloc[-1] - spy_hist['Close'].iloc[0]) / spy_hist['Close'].iloc[0]
            tlt_return = (tlt_hist['Close'].iloc[-1] - tlt_hist['Close'].iloc[0]) / tlt_hist['Close'].iloc[0]
            
            # If stocks outperform bonds = bullish
            diff = spy_return - tlt_return
            return min(100, max(0, 50 + diff * 500))
        except:
            return 50
    
    def _get_junk_bond_score(self) -> float:
        """Junk bond demand: HYG (high yield) vs LQD (investment grade)"""
        try:
            import yfinance as yf
            hyg = yf.Ticker("HYG")
            lqd = yf.Ticker("LQD")
            
            hyg_hist = hyg.history(period="1mo")
            lqd_hist = lqd.history(period="1mo")
            
            if hyg_hist.empty or lqd_hist.empty: return 50
            
            hyg_return = (hyg_hist['Close'].iloc[-1] - hyg_hist['Close'].iloc[0]) / hyg_hist['Close'].iloc[0]
            lqd_return = (lqd_hist['Close'].iloc[-1] - lqd_hist['Close'].iloc[0]) / lqd_hist['Close'].iloc[0]
            
            # If junk bonds outperform = risk-on = bullish
            diff = hyg_return - lqd_return
            return min(100, max(0, 50 + diff * 1000))
        except:
            return 50
    
    def _get_spy_rsi(self) -> float:
        """RSI of S&P 500"""
        try:
            import yfinance as yf
            spy = yf.Ticker("SPY")
            hist = spy.history(period="1mo")
            
            if hist.empty or len(hist) < 14: return 50
            
            delta = hist['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return float(rsi.iloc[-1])
        except:
            return 50

    def _get_crypto_fear_greed(self) -> Dict:
        """Crypto Fear & Greed จาก alternative.me (ฟรี)"""
        try:
            url = "https://api.alternative.me/fng/?limit=1"
            resp = requests.get(url, timeout=10)
            data = resp.json()
            
            if data.get("data"):
                score = int(data["data"][0]["value"])
                classification = data["data"][0]["value_classification"]
                timestamp = data["data"][0].get("timestamp", "")
                
                return {
                    "score": score,
                    "rating": classification,
                    "signal": self._score_to_signal(score),
                    "source": "alternative.me",
                    "timestamp": timestamp
                }
        except Exception as e:
            print(f"  [Crypto F&G Error] {e}")
        
        return {"score": 50, "rating": "Neutral", "signal": "HOLD", "source": "default"}
    
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
    
    # ==================== Additional Indicators ====================
    def get_market_breadth(self) -> Dict:
        """Market breadth analysis"""
        try:
            import yfinance as yf
            indices = {
                "SPY": "S&P 500",
                "QQQ": "NASDAQ 100",
                "DIA": "Dow Jones",
                "IWM": "Russell 2000",
                "VTI": "Total Market"
            }
            
            results = {}
            bullish, bearish, neutral = 0, 0, 0
            
            for symbol, name in indices.items():
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
            
            total = bullish + bearish + neutral
            signal = "BULLISH" if bullish > bearish else "BEARISH" if bearish > bullish else "NEUTRAL"
            
            return {
                "bullish": bullish,
                "bearish": bearish,
                "neutral": neutral,
                "signal": signal,
                "score": round((bullish / total) * 100) if total > 0 else 50,
                "indices": results
            }
        except Exception as e:
            print(f"  [Breadth Error] {e}")
            return {"bullish": 1, "bearish": 1, "neutral": 1, "signal": "NEUTRAL", "score": 50}

    def get_sector_performance(self) -> Dict:
        """Sector ETF performance analysis"""
        try:
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
            
            # Sort by 1-day performance
            results.sort(key=lambda x: x["change_1d"], reverse=True)
            
            # Determine market rotation
            top_sectors = [r["name"] for r in results[:3]]
            bottom_sectors = [r["name"] for r in results[-3:]]
            
            # Risk-on vs Risk-off
            risk_on = ["Technology", "Consumer Disc.", "Financials"]
            risk_off = ["Utilities", "Consumer Staples", "Healthcare"]
            
            risk_on_score = sum(1 for s in top_sectors if s in risk_on)
            risk_off_score = sum(1 for s in top_sectors if s in risk_off)
            
            if risk_on_score > risk_off_score:
                rotation = "RISK_ON"
            elif risk_off_score > risk_on_score:
                rotation = "RISK_OFF"
            else:
                rotation = "MIXED"
            
            return {
                "sectors": results,
                "top_performers": results[:3],
                "bottom_performers": results[-3:],
                "rotation": rotation,
                "signal": "BULLISH" if rotation == "RISK_ON" else "BEARISH" if rotation == "RISK_OFF" else "NEUTRAL"
            }
        except Exception as e:
            print(f"  [Sector Error] {e}")
            return {"sectors": [], "rotation": "UNKNOWN", "signal": "NEUTRAL"}
    
    def get_moving_averages(self) -> Dict:
        """Moving average analysis for S&P 500"""
        try:
            import yfinance as yf
            spy = yf.Ticker("SPY")
            hist = spy.history(period="1y")
            
            if hist.empty or len(hist) < 200:
                return {"trend": "NEUTRAL", "ma50_above_ma200": True}
            
            price = hist['Close'].iloc[-1]
            ma20 = hist['Close'].rolling(20).mean().iloc[-1]
            ma50 = hist['Close'].rolling(50).mean().iloc[-1]
            ma200 = hist['Close'].rolling(200).mean().iloc[-1]
            
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
            
            # Golden Cross / Death Cross
            cross = None
            ma50_hist = hist['Close'].rolling(50).mean()
            ma200_hist = hist['Close'].rolling(200).mean()
            
            if len(ma50_hist) >= 2 and len(ma200_hist) >= 2:
                if ma50_hist.iloc[-2] < ma200_hist.iloc[-2] and ma50_hist.iloc[-1] > ma200_hist.iloc[-1]:
                    cross = "GOLDEN_CROSS"
                elif ma50_hist.iloc[-2] > ma200_hist.iloc[-2] and ma50_hist.iloc[-1] < ma200_hist.iloc[-1]:
                    cross = "DEATH_CROSS"
            
            return {
                "trend": trend,
                "price": round(price, 2),
                "ma20": round(ma20, 2),
                "ma50": round(ma50, 2),
                "ma200": round(ma200, 2),
                "price_vs_ma20": "above" if price > ma20 else "below",
                "price_vs_ma50": "above" if price > ma50 else "below",
                "price_vs_ma200": "above" if price > ma200 else "below",
                "ma50_above_ma200": ma50 > ma200,
                "cross": cross,
                "bullish_signals": signals
            }
        except Exception as e:
            print(f"  [MA Error] {e}")
            return {"trend": "NEUTRAL", "ma50_above_ma200": True}

    def get_treasury_yields(self) -> Dict:
        """Treasury yield analysis (yield curve) using FRED API"""
        try:
            # Try FRED API first (most accurate for yield spread)
            fred_result = self._get_yield_spread_from_fred()
            if fred_result:
                return fred_result
            
            # Fallback to Yahoo Finance with better calculation
            return self._get_yields_from_yahoo()
            
        except Exception as e:
            print(f"  [Yields Error] {e}")
            return {"yields": {}, "inverted": False, "signal": "NEUTRAL", "spread": 0}
    
    def _get_yield_spread_from_fred(self) -> Optional[Dict]:
        """Get 10Y-3M spread directly from FRED (most accurate)"""
        try:
            # FRED API - T10Y3M is the 10Y minus 3M spread
            # Positive = normal, Negative = inverted
            url = "https://api.stlouisfed.org/fred/series/observations"
            params = {
                "series_id": "T10Y3M",
                "api_key": os.environ.get("FRED_API_KEY", ""),
                "file_type": "json",
                "sort_order": "desc",
                "limit": 5
            }
            
            # If no API key, try alternative free endpoint
            if not params["api_key"]:
                # Use alternative: fetch from FRED website directly
                alt_url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y3M"
                resp = requests.get(alt_url, timeout=10)
                if resp.status_code == 200:
                    lines = resp.text.strip().split('\n')
                    if len(lines) > 1:
                        # Get last valid value
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
                                    "interpretation": "Yield curve inverted - recession warning" if inverted else "Normal yield curve (steepening)",
                                    "source": "FRED"
                                }
                return None
            
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                observations = data.get("observations", [])
                
                # Get latest non-empty value
                for obs in observations:
                    if obs.get("value") and obs["value"] != ".":
                        spread = float(obs["value"])
                        inverted = spread < 0
                        
                        print(f"  [FRED API] 10Y-3M Spread: {spread}% ({'Inverted' if inverted else 'Normal'})")
                        
                        return {
                            "yields": {"spread_10y_3m": spread},
                            "spread": spread,
                            "inverted": inverted,
                            "signal": "BEARISH" if inverted else "NEUTRAL",
                            "interpretation": "Yield curve inverted - recession warning" if inverted else "Normal yield curve (steepening)",
                            "source": "FRED_API"
                        }
        except Exception as e:
            print(f"  [FRED Error] {e}")
        
        return None
    
    def _get_yields_from_yahoo(self) -> Dict:
        """Fallback: Get yields from Yahoo Finance with proper calculation"""
        try:
            import yfinance as yf
            
            yields = {}
            
            # Get 10Y yield
            tnx = yf.Ticker("^TNX")
            hist_10y = tnx.history(period="5d")
            if not hist_10y.empty:
                yields["10Y"] = round(float(hist_10y['Close'].iloc[-1]), 3)
            
            # Get 5Y yield
            fvx = yf.Ticker("^FVX")
            hist_5y = fvx.history(period="5d")
            if not hist_5y.empty:
                yields["5Y"] = round(float(hist_5y['Close'].iloc[-1]), 3)
            
            # Get 2Y yield (better than 3M for comparison)
            twy = yf.Ticker("^IRX")
            hist_3m = twy.history(period="5d")
            if not hist_3m.empty:
                # ^IRX is discount rate, convert to approximate bond equivalent yield
                # BEY ≈ (360 * discount_rate) / (360 - 91 * discount_rate / 100)
                discount_rate = float(hist_3m['Close'].iloc[-1])
                # Simplified: just use as-is but note it's approximate
                yields["3M"] = round(discount_rate, 3)
            
            # Calculate spread
            spread = 0
            inverted = False
            
            if "10Y" in yields and "3M" in yields:
                spread = round(yields["10Y"] - yields["3M"], 3)
                inverted = spread < 0
            
            print(f"  [Yahoo] 10Y: {yields.get('10Y')}%, 3M: {yields.get('3M')}%, Spread: {spread}%")
            
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
    
    # ==================== AI Score Calculation ====================
    def calculate_ai_score(self) -> Dict:
        """Calculate comprehensive AI market score"""
        print("  Fetching VIX...")
        vix = self.get_vix()
        
        print("  Calculating Fear & Greed...")
        fear_greed = self.get_fear_greed_index()
        
        print("  Analyzing Market Breadth...")
        breadth = self.get_market_breadth()
        
        print("  Analyzing Sectors...")
        sectors = self.get_sector_performance()
        
        print("  Analyzing Moving Averages...")
        ma = self.get_moving_averages()
        
        print("  Checking Treasury Yields...")
        yields = self.get_treasury_yields()
        
        # Calculate weighted score
        scores = []
        weights = []
        
        # 1. Fear & Greed (25%)
        fg_score = fear_greed.get("score", 50)
        # Contrarian: extreme fear = buy opportunity
        if fg_score <= 20:
            scores.append(85)  # Extreme fear = great buy
        elif fg_score <= 40:
            scores.append(70)  # Fear = good buy
        elif fg_score <= 60:
            scores.append(50)  # Neutral
        elif fg_score <= 80:
            scores.append(35)  # Greed = caution
        else:
            scores.append(15)  # Extreme greed = avoid
        weights.append(25)
        
        # 2. VIX (20%)
        vix_val = vix.get("value", 20)
        if vix_val > 35:
            scores.append(80)  # Extreme fear = opportunity
        elif vix_val > 25:
            scores.append(65)
        elif vix_val > 20:
            scores.append(50)
        elif vix_val > 15:
            scores.append(45)
        else:
            scores.append(35)  # Too complacent
        weights.append(20)
        
        # 3. Market Breadth (15%)
        breadth_score = breadth.get("score", 50)
        scores.append(breadth_score)
        weights.append(15)
        
        # 4. Sector Rotation (15%)
        rotation = sectors.get("rotation", "MIXED")
        if rotation == "RISK_ON":
            scores.append(70)
        elif rotation == "RISK_OFF":
            scores.append(30)
        else:
            scores.append(50)
        weights.append(15)
        
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
        
        # 6. Yield Curve (10%)
        if yields.get("inverted"):
            scores.append(25)  # Recession warning
        else:
            scores.append(55)
        weights.append(10)
        
        # Calculate final score
        total_score = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
        final_score = round(total_score)
        
        # Generate recommendation
        if final_score >= 75:
            recommendation = "STRONG_BUY"
            message = "🟢 สภาวะตลาดเหมาะสมมากสำหรับการเข้าซื้อ (Extreme Fear = Opportunity)"
        elif final_score >= 60:
            recommendation = "BUY"
            message = "🟢 สภาวะตลาดค่อนข้างดี พิจารณาเข้าซื้อได้"
        elif final_score >= 45:
            recommendation = "HOLD"
            message = "🟡 สภาวะตลาดปกติ รอจังหวะที่ดีกว่า"
        elif final_score >= 30:
            recommendation = "CAUTIOUS"
            message = "🟠 ระวัง ตลาดมีความเสี่ยง ลดขนาด position"
        else:
            recommendation = "AVOID"
            message = "🔴 หลีกเลี่ยงการเข้าซื้อ ตลาดมีความเสี่ยงสูง"
        
        return {
            "score": final_score,
            "recommendation": recommendation,
            "message": message,
            "indicators": {
                "fear_greed": fear_greed,
                "vix": vix,
                "market_breadth": breadth,
                "sectors": sectors,
                "moving_averages": ma,
                "treasury_yields": yields
            },
            "score_breakdown": {
                "fear_greed": scores[0],
                "vix": scores[1],
                "breadth": scores[2],
                "sectors": scores[3],
                "ma": scores[4],
                "yields": scores[5]
            },
            "updated_at": datetime.now().isoformat()
        }

    def analyze(self) -> Dict:
        """Main analysis function"""
        print("=" * 50)
        print("🤖 Analyzing Market Sentiment...")
        print("=" * 50)
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
    print(f"� Fear & BGreed (Stock): {indicators.get('fear_greed', {}).get('score', 'N/A')}")
    print(f"🪙 Fear & Greed (Crypto): {indicators.get('fear_greed', {}).get('crypto', {}).get('score', 'N/A')}")
    print(f"� MarTket Breadth: {indicators.get('market_breadth', {}).get('signal', 'N/A')}")
    print(f"� Secltor Rotation: {indicators.get('sectors', {}).get('rotation', 'N/A')}")
    print(f"📉 MA Trend: {indicators.get('moving_averages', {}).get('trend', 'N/A')}")
    print(f"📈 Yield Curve: {'Inverted ⚠️' if indicators.get('treasury_yields', {}).get('inverted') else 'Normal'}")
    
    # Save to file
    os.makedirs('data', exist_ok=True)
    with open('data/market_sentiment.json', 'w') as f:
        json.dump(result, f, indent=2)
    print("\n✅ Saved to data/market_sentiment.json")
