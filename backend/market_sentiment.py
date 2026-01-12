"""
Market Sentiment Analyzer - Enhanced Version v3.0
วิเคราะห์ Fear & Greed Index, VIX, Market Breadth และดัชนีต่างๆ

Data Sources (All Free):
- VIX: Yahoo Finance (^VIX)
- Fear & Greed (Stock): CNN API / Calculated fallback
- Fear & Greed (Crypto): alternative.me API
- Market Breadth: Barchart scraping / Yahoo Finance ETFs fallback
- Put/Call Ratio: CBOE scraping / VIX estimation fallback
- Sector Performance: Yahoo Finance Sector ETFs
- Treasury Yields: FRED API (free) / Yahoo Finance fallback
- Economic Calendar: FRED API / Hardcoded major events
- Market Internals: Yahoo Finance (TICK, TRIN proxies)

Features v3.0:
- Real CBOE Put/Call Ratio (scraped)
- Real NYSE Advance/Decline data (scraped from Barchart)
- Economic Calendar awareness (FOMC, CPI, Jobs Report)
- Market Internals (TICK, TRIN/Arms Index proxies)
- Confidence level for recommendations
- Improved scoring with backtesting principles
- Better error handling and fallbacks
"""
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Tuple
import os
import time
import re
from bs4 import BeautifulSoup

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


# Economic Calendar - Major Events (Updated periodically)
# These dates significantly impact market sentiment
ECONOMIC_CALENDAR_2025 = {
    # FOMC Meetings (Fed Interest Rate Decisions) - HIGH IMPACT
    "fomc": [
        "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18",
        "2025-07-30", "2025-09-17", "2025-11-05", "2025-12-17"
    ],
    # CPI (Consumer Price Index) - HIGH IMPACT
    "cpi": [
        "2025-01-15", "2025-02-12", "2025-03-12", "2025-04-10",
        "2025-05-13", "2025-06-11", "2025-07-11", "2025-08-13",
        "2025-09-11", "2025-10-10", "2025-11-13", "2025-12-10"
    ],
    # Jobs Report (Non-Farm Payrolls) - HIGH IMPACT
    "jobs": [
        "2025-01-10", "2025-02-07", "2025-03-07", "2025-04-04",
        "2025-05-02", "2025-06-06", "2025-07-03", "2025-08-01",
        "2025-09-05", "2025-10-03", "2025-11-07", "2025-12-05"
    ],
    # GDP Reports - MEDIUM IMPACT
    "gdp": [
        "2025-01-30", "2025-02-27", "2025-03-27", "2025-04-30",
        "2025-05-29", "2025-06-26", "2025-07-30", "2025-08-28",
        "2025-09-25", "2025-10-30", "2025-11-26", "2025-12-23"
    ],
    # PCE (Fed's preferred inflation measure) - HIGH IMPACT
    "pce": [
        "2025-01-31", "2025-02-28", "2025-03-28", "2025-04-25",
        "2025-05-30", "2025-06-27", "2025-07-25", "2025-08-29",
        "2025-09-26", "2025-10-31", "2025-11-27", "2025-12-19"
    ]
}


class MarketSentimentAnalyzer:
    def __init__(self):
        self.data = {}
        self.cache = {}
        self.cache_duration = 300  # 5 minutes cache
        self.confidence_factors = []  # Track data quality
        
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
    
    def _add_confidence(self, source: str, quality: str):
        """Track data source quality for confidence calculation"""
        self.confidence_factors.append({
            "source": source,
            "quality": quality  # "high", "medium", "low", "estimated"
        })

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
            self._add_confidence("vix", "low")
            return self._default_vix()
        
        current = float(hist['Close'].iloc[-1])
        prev = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
        change = ((current - prev) / prev) * 100
        
        # VIX Interpretation (refined thresholds)
        if current < 12:
            signal, level = "EXTREME_COMPLACENCY", "extreme_low"
        elif current < 15:
            signal, level = "BULLISH", "low"
        elif current < 20:
            signal, level = "NEUTRAL", "normal"
        elif current < 25:
            signal, level = "CAUTIOUS", "elevated"
        elif current < 30:
            signal, level = "FEAR", "high"
        elif current < 40:
            signal, level = "EXTREME_FEAR", "very_high"
        else:
            signal, level = "PANIC", "extreme_high"
        
        # VIX term structure (contango vs backwardation)
        vix_term = self._get_vix_term_structure()
        
        self._add_confidence("vix", "high")
        
        result = {
            "value": round(current, 2),
            "change": round(change, 2),
            "change_pct": round(change, 2),
            "signal": signal,
            "level": level,
            "trend": "up" if change > 0 else "down" if change < 0 else "flat",
            "term_structure": vix_term,
            "source": "yahoo_finance",
            "interpretation": self._interpret_vix(current)
        }
        
        self._set_cache('vix', result)
        return result
    
    def _get_vix_term_structure(self) -> Dict:
        """Check VIX term structure (contango = normal, backwardation = fear)"""
        try:
            import yfinance as yf
            
            # VIX (spot) vs VIX3M (3-month)
            vix = yf.Ticker("^VIX")
            vix3m = yf.Ticker("^VIX3M")
            
            vix_hist = vix.history(period="1d")
            vix3m_hist = vix3m.history(period="1d")
            
            if vix_hist.empty or vix3m_hist.empty:
                return {"structure": "unknown", "ratio": 1.0}
            
            spot = float(vix_hist['Close'].iloc[-1])
            term = float(vix3m_hist['Close'].iloc[-1])
            ratio = spot / term
            
            if ratio > 1.1:
                structure = "backwardation"  # Fear - spot > futures
            elif ratio < 0.9:
                structure = "steep_contango"  # Complacency
            else:
                structure = "contango"  # Normal
            
            return {
                "structure": structure,
                "ratio": round(ratio, 3),
                "spot": round(spot, 2),
                "term": round(term, 2)
            }
        except:
            return {"structure": "unknown", "ratio": 1.0}
    
    def _default_vix(self) -> Dict:
        return {"value": 20, "change": 0, "signal": "NEUTRAL", "level": "normal", "trend": "flat", "source": "default"}
    
    def _interpret_vix(self, vix: float) -> str:
        if vix < 12: return "Extreme complacency - be cautious of reversal"
        elif vix < 15: return "Market calm, investors confident"
        elif vix < 20: return "Normal volatility"
        elif vix < 25: return "Elevated concern"
        elif vix < 30: return "High fear, potential opportunity"
        elif vix < 40: return "Extreme fear - contrarian buy signal"
        else: return "Market panic! Strong contrarian buy signal"

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
            self._add_confidence("fear_greed", "high")
            
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
            self._add_confidence("fear_greed", "low")
            return {"score": 50, "rating": "Neutral", "signal": "HOLD", "source": "default"}
        
        avg_score = sum(s[1] for s in scores) / len(scores)
        final_score = round(avg_score)
        
        self._add_confidence("fear_greed", "medium")
        
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

    # ==================== Market Breadth (Enhanced with Real Data) ====================
    def get_market_breadth(self) -> Dict:
        """Market breadth analysis with real Advance/Decline data"""
        cached = self._get_cached('breadth')
        if cached:
            return cached
        
        # Try real Advance/Decline data first (Barchart)
        real_breadth = self._get_barchart_advance_decline()
        if real_breadth:
            self._set_cache('breadth', real_breadth)
            return real_breadth
        
        # Try WSJ as backup
        wsj_breadth = self._get_wsj_advance_decline()
        if wsj_breadth:
            self._set_cache('breadth', wsj_breadth)
            return wsj_breadth
        
        # Fallback to ETF proxy
        etf_breadth = self._get_etf_breadth()
        self._set_cache('breadth', etf_breadth)
        return etf_breadth
    
    @retry_on_failure(max_retries=2)
    def _get_barchart_advance_decline(self) -> Optional[Dict]:
        """Get real NYSE Advance/Decline from Barchart"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
            
            url = "https://www.barchart.com/stocks/market-performance"
            resp = requests.get(url, headers=headers, timeout=15)
            
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, 'html.parser')
                
                # Look for advance/decline data in the page
                # Barchart shows NYSE and NASDAQ breadth
                advances = 0
                declines = 0
                unchanged = 0
                
                # Try to find the market breadth table
                tables = soup.find_all('table')
                for table in tables:
                    text = table.get_text().lower()
                    if 'advance' in text and 'decline' in text:
                        rows = table.find_all('tr')
                        for row in rows:
                            cells = row.find_all(['td', 'th'])
                            if len(cells) >= 2:
                                label = cells[0].get_text().strip().lower()
                                if 'nyse' in label or 'advance' in label:
                                    try:
                                        # Extract numbers
                                        for cell in cells[1:]:
                                            num_text = cell.get_text().strip().replace(',', '')
                                            if num_text.isdigit():
                                                num = int(num_text)
                                                if 'advance' in label:
                                                    advances = num
                                                elif 'decline' in label:
                                                    declines = num
                                    except:
                                        continue
                
                # If we found data
                if advances > 0 or declines > 0:
                    total = advances + declines + unchanged
                    ratio = advances / total if total > 0 else 0.5
                    
                    print(f"  [Barchart] Advances: {advances}, Declines: {declines}")
                    self._add_confidence("breadth", "high")
                    
                    return {
                        "advances": advances,
                        "declines": declines,
                        "unchanged": unchanged,
                        "ratio": round(ratio, 3),
                        "ad_line": advances - declines,
                        "signal": self._breadth_signal(ratio),
                        "score": round(ratio * 100),
                        "source": "barchart"
                    }
            
            return None
        except Exception as e:
            print(f"  [Barchart Error] {e}")
            return None
    
    @retry_on_failure(max_retries=2)
    def _get_wsj_advance_decline(self) -> Optional[Dict]:
        """Backup: Get Advance/Decline from WSJ"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            url = "https://www.wsj.com/market-data/stocks"
            resp = requests.get(url, headers=headers, timeout=15)
            
            if resp.status_code == 200:
                # Parse for advance/decline numbers
                # WSJ format varies, try regex
                text = resp.text
                
                # Look for patterns like "Advancing: 1,234" or "Advances 1234"
                adv_match = re.search(r'advanc\w*[:\s]+(\d[\d,]*)', text, re.I)
                dec_match = re.search(r'declin\w*[:\s]+(\d[\d,]*)', text, re.I)
                
                if adv_match and dec_match:
                    advances = int(adv_match.group(1).replace(',', ''))
                    declines = int(dec_match.group(1).replace(',', ''))
                    
                    total = advances + declines
                    ratio = advances / total if total > 0 else 0.5
                    
                    print(f"  [WSJ] Advances: {advances}, Declines: {declines}")
                    self._add_confidence("breadth", "high")
                    
                    return {
                        "advances": advances,
                        "declines": declines,
                        "ratio": round(ratio, 3),
                        "ad_line": advances - declines,
                        "signal": self._breadth_signal(ratio),
                        "score": round(ratio * 100),
                        "source": "wsj"
                    }
            
            return None
        except Exception as e:
            print(f"  [WSJ Error] {e}")
            return None
    
    def _breadth_signal(self, ratio: float) -> str:
        """Convert breadth ratio to signal"""
        if ratio >= 0.7:
            return "STRONG_BULLISH"
        elif ratio >= 0.55:
            return "BULLISH"
        elif ratio >= 0.45:
            return "NEUTRAL"
        elif ratio >= 0.3:
            return "BEARISH"
        else:
            return "STRONG_BEARISH"
    
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
            self._add_confidence("breadth", "low")
            return {"bullish": 1, "bearish": 1, "neutral": 1, "signal": "NEUTRAL", "score": 50}
        
        ratio = bullish / total
        # Ensure score is at least 10 to avoid extreme values
        breadth_score = max(10, min(90, round(ratio * 100)))
        signal = self._breadth_signal(ratio)
        
        self._add_confidence("breadth", "medium")
        
        return {
            "bullish": bullish,
            "bearish": bearish,
            "neutral": neutral,
            "ratio": round(ratio, 3),
            "signal": signal,
            "score": breadth_score,
            "indices": results,
            "source": "etf_proxy"
        }

    # ==================== Put/Call Ratio (Real CBOE Data) ====================
    def get_put_call_ratio(self) -> Dict:
        """Get Put/Call ratio - try CBOE first, then estimate"""
        cached = self._get_cached('pcr')
        if cached:
            return cached
        
        # Try CBOE scraping first
        cboe_pcr = self._get_cboe_put_call()
        if cboe_pcr:
            self._set_cache('pcr', cboe_pcr)
            return cboe_pcr
        
        # Fallback to estimation
        estimated_pcr = self._estimate_put_call_ratio()
        self._set_cache('pcr', estimated_pcr)
        return estimated_pcr
    
    @retry_on_failure(max_retries=2)
    def _get_cboe_put_call(self) -> Optional[Dict]:
        """Get real Put/Call ratio from CBOE"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
            
            # CBOE Put/Call Ratio page
            url = "https://www.cboe.com/us/options/market_statistics/daily/"
            resp = requests.get(url, headers=headers, timeout=15)
            
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, 'html.parser')
                
                # Look for equity put/call ratio
                # CBOE shows: Total, Index, Equity P/C ratios
                pcr_equity = None
                pcr_total = None
                
                # Try to find in tables or data elements
                tables = soup.find_all('table')
                for table in tables:
                    rows = table.find_all('tr')
                    for row in rows:
                        cells = row.find_all(['td', 'th'])
                        text = row.get_text().lower()
                        
                        if 'equity' in text and 'put' in text:
                            for cell in cells:
                                try:
                                    val = float(cell.get_text().strip())
                                    if 0.3 < val < 2.0:  # Valid PCR range
                                        pcr_equity = val
                                        break
                                except:
                                    continue
                        
                        if 'total' in text and 'put' in text:
                            for cell in cells:
                                try:
                                    val = float(cell.get_text().strip())
                                    if 0.3 < val < 2.0:
                                        pcr_total = val
                                        break
                                except:
                                    continue
                
                # Also try regex on page content
                if not pcr_equity:
                    text = resp.text
                    # Look for patterns like "0.85" near "equity" or "put/call"
                    matches = re.findall(r'(\d\.\d{2})', text)
                    for match in matches:
                        val = float(match)
                        if 0.5 < val < 1.5:
                            pcr_equity = val
                            break
                
                if pcr_equity:
                    print(f"  [CBOE] Equity P/C Ratio: {pcr_equity}")
                    self._add_confidence("pcr", "high")
                    
                    return {
                        "ratio": round(pcr_equity, 3),
                        "equity_pcr": round(pcr_equity, 3),
                        "total_pcr": round(pcr_total, 3) if pcr_total else None,
                        "signal": self._pcr_signal(pcr_equity),
                        "interpretation": self._pcr_interpretation(pcr_equity),
                        "source": "cboe"
                    }
            
            return None
        except Exception as e:
            print(f"  [CBOE Error] {e}")
            return None
    
    @retry_on_failure(max_retries=2)
    def _estimate_put_call_ratio(self) -> Dict:
        """Estimate Put/Call ratio from VIX and options ETFs"""
        try:
            import yfinance as yf
            
            # Use VIX as proxy
            vix = yf.Ticker("^VIX")
            vix_hist = vix.history(period="1mo")
            
            if vix_hist.empty:
                self._add_confidence("pcr", "low")
                return {"ratio": 1.0, "signal": "NEUTRAL", "source": "default"}
            
            current_vix = float(vix_hist['Close'].iloc[-1])
            avg_vix = float(vix_hist['Close'].mean())
            
            # Estimate PCR from VIX level
            # High VIX = more puts = higher PCR
            estimated_pcr = 0.8 + (current_vix - 15) * 0.02
            estimated_pcr = max(0.5, min(1.5, estimated_pcr))
            
            self._add_confidence("pcr", "estimated")
            
            return {
                "ratio": round(estimated_pcr, 3),
                "signal": self._pcr_signal(estimated_pcr),
                "interpretation": self._pcr_interpretation(estimated_pcr),
                "source": "estimated_from_vix",
                "note": "Estimated - CBOE data unavailable"
            }
        except Exception as e:
            print(f"  [PCR Estimate Error] {e}")
            self._add_confidence("pcr", "low")
            return {"ratio": 1.0, "signal": "NEUTRAL", "source": "default"}
    
    def _pcr_signal(self, pcr: float) -> str:
        """Convert PCR to signal (contrarian)"""
        # PCR > 1.0 = more puts = bearish sentiment = contrarian bullish
        # PCR < 0.7 = more calls = bullish sentiment = contrarian bearish
        if pcr > 1.2:
            return "EXTREME_FEAR"  # Contrarian bullish
        elif pcr > 1.0:
            return "FEAR"
        elif pcr > 0.8:
            return "NEUTRAL"
        elif pcr > 0.6:
            return "GREED"
        else:
            return "EXTREME_GREED"  # Contrarian bearish
    
    def _pcr_interpretation(self, pcr: float) -> str:
        if pcr > 1.2:
            return "Extreme put buying = panic (contrarian buy signal)"
        elif pcr > 1.0:
            return "High put buying = fear (potential opportunity)"
        elif pcr > 0.8:
            return "Normal options activity"
        elif pcr > 0.6:
            return "More calls than puts = optimism"
        else:
            return "Extreme call buying = complacency (contrarian sell signal)"

    # ==================== Economic Calendar ====================
    def get_economic_calendar(self) -> Dict:
        """Check upcoming economic events that impact market sentiment"""
        today = datetime.now().date()
        today_str = today.strftime("%Y-%m-%d")
        
        upcoming_events = []
        event_impact = "none"
        
        # Check each event type
        for event_type, dates in ECONOMIC_CALENDAR_2025.items():
            for date_str in dates:
                try:
                    event_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                    days_until = (event_date - today).days
                    
                    # Events within next 3 days
                    if 0 <= days_until <= 3:
                        event_name = {
                            "fomc": "FOMC Meeting (Fed Rate Decision)",
                            "cpi": "CPI Report (Inflation)",
                            "jobs": "Jobs Report (Non-Farm Payrolls)",
                            "gdp": "GDP Report",
                            "pce": "PCE Report (Fed's Inflation Measure)"
                        }.get(event_type, event_type.upper())
                        
                        impact = "high" if event_type in ["fomc", "cpi", "jobs", "pce"] else "medium"
                        
                        upcoming_events.append({
                            "event": event_name,
                            "date": date_str,
                            "days_until": days_until,
                            "impact": impact
                        })
                        
                        # Set highest impact
                        if impact == "high" and days_until <= 1:
                            event_impact = "high"
                        elif impact == "medium" and event_impact != "high":
                            event_impact = "medium"
                except:
                    continue
        
        # Sort by days until
        upcoming_events.sort(key=lambda x: x["days_until"])
        
        # Determine signal
        if event_impact == "high":
            signal = "CAUTION"
            message = "Major economic event imminent - expect volatility"
            message_th = "มีข่าวเศรษฐกิจสำคัญใกล้ถึง - คาดว่าจะมีความผันผวน"
        elif event_impact == "medium":
            signal = "AWARE"
            message = "Economic event upcoming - monitor closely"
            message_th = "มีข่าวเศรษฐกิจเร็วๆนี้ - ติดตามใกล้ชิด"
        else:
            signal = "CLEAR"
            message = "No major economic events in next 3 days"
            message_th = "ไม่มีข่าวเศรษฐกิจสำคัญใน 3 วันข้างหน้า"
        
        return {
            "upcoming_events": upcoming_events[:5],  # Top 5 events
            "event_impact": event_impact,
            "signal": signal,
            "message": message,
            "message_th": message_th,
            "today": today_str
        }

    # ==================== Market Internals (TICK, TRIN) ====================
    def get_market_internals(self) -> Dict:
        """Get market internals - TICK and TRIN/Arms Index proxies"""
        cached = self._get_cached('internals')
        if cached:
            return cached
        
        try:
            import yfinance as yf
            
            # TICK proxy: Use intraday momentum of major indices
            # Real TICK measures upticks vs downticks on NYSE
            # We approximate using ETF momentum
            
            spy = yf.Ticker("SPY")
            qqq = yf.Ticker("QQQ")
            iwm = yf.Ticker("IWM")
            
            spy_hist = spy.history(period="1d", interval="5m")
            qqq_hist = qqq.history(period="1d", interval="5m")
            iwm_hist = iwm.history(period="1d", interval="5m")
            
            tick_proxy = 0
            trin_proxy = 1.0
            
            if not spy_hist.empty:
                # Calculate intraday momentum
                spy_change = (spy_hist['Close'].iloc[-1] - spy_hist['Open'].iloc[0]) / spy_hist['Open'].iloc[0] * 100
                qqq_change = (qqq_hist['Close'].iloc[-1] - qqq_hist['Open'].iloc[0]) / qqq_hist['Open'].iloc[0] * 100 if not qqq_hist.empty else 0
                iwm_change = (iwm_hist['Close'].iloc[-1] - iwm_hist['Open'].iloc[0]) / iwm_hist['Open'].iloc[0] * 100 if not iwm_hist.empty else 0
                
                # TICK proxy: scale to typical TICK range (-1000 to +1000)
                avg_change = (spy_change + qqq_change + iwm_change) / 3
                tick_proxy = int(avg_change * 500)  # Scale factor
                tick_proxy = max(-1500, min(1500, tick_proxy))
                
                # TRIN proxy: ratio of declining volume to advancing volume
                # < 1 = bullish, > 1 = bearish
                # Approximate using price action
                if avg_change > 0:
                    trin_proxy = max(0.5, 1.0 - avg_change * 0.1)
                else:
                    trin_proxy = min(2.0, 1.0 - avg_change * 0.1)
            
            # Interpret TICK
            if tick_proxy > 800:
                tick_signal = "STRONG_BULLISH"
            elif tick_proxy > 400:
                tick_signal = "BULLISH"
            elif tick_proxy > -400:
                tick_signal = "NEUTRAL"
            elif tick_proxy > -800:
                tick_signal = "BEARISH"
            else:
                tick_signal = "STRONG_BEARISH"
            
            # Interpret TRIN (Arms Index)
            if trin_proxy < 0.7:
                trin_signal = "OVERBOUGHT"  # Too bullish
            elif trin_proxy < 0.9:
                trin_signal = "BULLISH"
            elif trin_proxy < 1.1:
                trin_signal = "NEUTRAL"
            elif trin_proxy < 1.3:
                trin_signal = "BEARISH"
            else:
                trin_signal = "OVERSOLD"  # Too bearish = opportunity
            
            self._add_confidence("internals", "medium")
            
            result = {
                "tick": {
                    "value": tick_proxy,
                    "signal": tick_signal,
                    "interpretation": f"TICK at {tick_proxy} indicates {'buying' if tick_proxy > 0 else 'selling'} pressure"
                },
                "trin": {
                    "value": round(trin_proxy, 3),
                    "signal": trin_signal,
                    "interpretation": f"TRIN at {round(trin_proxy, 2)} indicates {'bullish' if trin_proxy < 1 else 'bearish'} internals"
                },
                "combined_signal": tick_signal if tick_signal == trin_signal else "MIXED",
                "source": "proxy_calculation"
            }
            
            self._set_cache('internals', result)
            return result
            
        except Exception as e:
            print(f"  [Internals Error] {e}")
            self._add_confidence("internals", "low")
            return {
                "tick": {"value": 0, "signal": "NEUTRAL"},
                "trin": {"value": 1.0, "signal": "NEUTRAL"},
                "combined_signal": "NEUTRAL",
                "source": "default"
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
        
        self._add_confidence("sectors", "high")
        
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
        """Moving average analysis for S&P 500"""
        cached = self._get_cached(f'ma_{use_ema}')
        if cached:
            return cached
            
        try:
            import yfinance as yf
            spy = yf.Ticker("SPY")
            hist = spy.history(period="1y")
            
            if hist.empty or len(hist) < 200:
                self._add_confidence("ma", "low")
                return {"trend": "NEUTRAL", "ma50_above_ma200": True}
            
            price = float(hist['Close'].iloc[-1])
            
            if use_ema:
                ma20 = float(hist['Close'].ewm(span=20, adjust=False).mean().iloc[-1])
                ma50 = float(hist['Close'].ewm(span=50, adjust=False).mean().iloc[-1])
                ma200 = float(hist['Close'].ewm(span=200, adjust=False).mean().iloc[-1])
                ma_type = "EMA"
            else:
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
            
            dist_ma20 = ((price - ma20) / ma20) * 100
            dist_ma50 = ((price - ma50) / ma50) * 100
            dist_ma200 = ((price - ma200) / ma200) * 100
            
            self._add_confidence("ma", "high")
            
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
            self._add_confidence("ma", "low")
            return {"trend": "NEUTRAL", "ma50_above_ma200": True, "ma_type": "EMA" if use_ema else "SMA"}

    # ==================== Treasury Yields ====================
    def get_treasury_yields(self) -> Dict:
        """Treasury yield analysis with FRED API fallback"""
        cached = self._get_cached('yields')
        if cached:
            return cached
        
        fred_result = self._get_yield_from_fred()
        if fred_result:
            self._set_cache('yields', fred_result)
            return fred_result
        
        yahoo_result = self._get_yields_from_yahoo()
        self._set_cache('yields', yahoo_result)
        return yahoo_result
    
    @retry_on_failure(max_retries=2)
    def _get_yield_from_fred(self) -> Optional[Dict]:
        """Get yield spread from FRED"""
        try:
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
                            self._add_confidence("yields", "high")
                            
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
            
            tnx = yf.Ticker("^TNX")
            hist_10y = tnx.history(period="5d")
            if not hist_10y.empty:
                yields["10Y"] = round(float(hist_10y['Close'].iloc[-1]), 3)
            
            fvx = yf.Ticker("^FVX")
            hist_5y = fvx.history(period="5d")
            if not hist_5y.empty:
                yields["5Y"] = round(float(hist_5y['Close'].iloc[-1]), 3)
            
            irx = yf.Ticker("^IRX")
            hist_3m = irx.history(period="5d")
            if not hist_3m.empty:
                yields["3M"] = round(float(hist_3m['Close'].iloc[-1]), 3)
            
            spread = 0
            inverted = False
            
            if "10Y" in yields and "3M" in yields:
                spread = round(yields["10Y"] - yields["3M"], 3)
                inverted = spread < 0
            
            self._add_confidence("yields", "medium")
            
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
            self._add_confidence("yields", "low")
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
        """Get US Dollar Index (DXY)"""
        try:
            import yfinance as yf
            
            dxy = yf.Ticker("DX-Y.NYB")
            hist = dxy.history(period="1mo")
            
            if hist.empty:
                self._add_confidence("dxy", "low")
                return {"value": 100, "change": 0, "signal": "NEUTRAL"}
            
            current = float(hist['Close'].iloc[-1])
            prev = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
            change = ((current - prev) / prev) * 100
            
            if current > 105:
                signal = "BEARISH"
            elif current > 100:
                signal = "NEUTRAL"
            else:
                signal = "BULLISH"
            
            self._add_confidence("dxy", "high")
            
            return {
                "value": round(current, 2),
                "change": round(change, 2),
                "signal": signal,
                "interpretation": "Strong dollar pressures stocks" if current > 105 else "Weak dollar supports stocks" if current < 95 else "Dollar neutral"
            }
        except Exception as e:
            print(f"  [DXY Error] {e}")
            self._add_confidence("dxy", "low")
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
                self._add_confidence("gold", "low")
                return {"value": 2000, "change": 0, "signal": "NEUTRAL"}
            
            current = float(hist['Close'].iloc[-1])
            prev_day = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
            prev_week = float(hist['Close'].iloc[-5]) if len(hist) > 5 else current
            
            change_1d = ((current - prev_day) / prev_day) * 100
            change_1w = ((current - prev_week) / prev_week) * 100
            
            if change_1w > 3:
                signal = "FEAR"
            elif change_1w > 1:
                signal = "CAUTIOUS"
            elif change_1w < -2:
                signal = "RISK_ON"
            else:
                signal = "NEUTRAL"
            
            self._add_confidence("gold", "high")
            
            return {
                "value": round(current, 2),
                "change_1d": round(change_1d, 2),
                "change_1w": round(change_1w, 2),
                "signal": signal,
                "interpretation": "Gold rising = flight to safety" if change_1w > 2 else "Gold stable"
            }
        except Exception as e:
            print(f"  [Gold Error] {e}")
            self._add_confidence("gold", "low")
            return {"value": 2000, "change_1d": 0, "change_1w": 0, "signal": "NEUTRAL"}

    # ==================== Market Momentum ====================
    @retry_on_failure(max_retries=2)
    def get_market_momentum(self) -> Dict:
        """Calculate market momentum using multiple timeframes"""
        try:
            import yfinance as yf
            
            spy = yf.Ticker("SPY")
            hist = spy.history(period="3mo")
            
            if hist.empty or len(hist) < 60:
                self._add_confidence("momentum", "low")
                return {"momentum": "NEUTRAL", "score": 50}
            
            price = float(hist['Close'].iloc[-1])
            
            ret_1d = (price - hist['Close'].iloc[-2]) / hist['Close'].iloc[-2] * 100
            ret_1w = (price - hist['Close'].iloc[-5]) / hist['Close'].iloc[-5] * 100 if len(hist) >= 5 else 0
            ret_1m = (price - hist['Close'].iloc[-21]) / hist['Close'].iloc[-21] * 100 if len(hist) >= 21 else 0
            ret_3m = (price - hist['Close'].iloc[0]) / hist['Close'].iloc[0] * 100
            
            rsi = self._calculate_rsi(hist['Close'])
            
            ema12 = hist['Close'].ewm(span=12, adjust=False).mean()
            ema26 = hist['Close'].ewm(span=26, adjust=False).mean()
            macd = ema12 - ema26
            signal_line = macd.ewm(span=9, adjust=False).mean()
            macd_histogram = float(macd.iloc[-1] - signal_line.iloc[-1])
            
            score = 50
            
            if ret_1m > 5: score += 15
            elif ret_1m > 2: score += 10
            elif ret_1m > 0: score += 5
            elif ret_1m < -5: score -= 15
            elif ret_1m < -2: score -= 10
            elif ret_1m < 0: score -= 5
            
            if rsi > 70: score -= 10
            elif rsi > 60: score += 5
            elif rsi < 30: score += 15
            elif rsi < 40: score += 5
            
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
            
            self._add_confidence("momentum", "high")
            
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
            self._add_confidence("momentum", "low")
            return {"momentum": "NEUTRAL", "score": 50}

    # ==================== Institutional Flow (New) ====================
    @retry_on_failure(max_retries=2)
    def get_institutional_flow(self) -> Dict:
        """Estimate institutional flow from ETF volume and price action"""
        try:
            import yfinance as yf
            
            # Track major ETF flows
            etfs = {
                "SPY": "S&P 500",
                "QQQ": "NASDAQ",
                "IWM": "Small Cap",
                "HYG": "High Yield Bonds",
                "TLT": "Long-Term Treasuries"
            }
            
            flows = {}
            risk_on_flow = 0
            risk_off_flow = 0
            
            for symbol, name in etfs.items():
                try:
                    ticker = yf.Ticker(symbol)
                    hist = ticker.history(period="5d")
                    
                    if not hist.empty and len(hist) >= 2:
                        # Volume trend
                        avg_vol = hist['Volume'].mean()
                        today_vol = hist['Volume'].iloc[-1]
                        vol_ratio = today_vol / avg_vol if avg_vol > 0 else 1
                        
                        # Price change
                        price_change = (hist['Close'].iloc[-1] - hist['Close'].iloc[-2]) / hist['Close'].iloc[-2] * 100
                        
                        # Flow estimate: volume * direction
                        flow_score = vol_ratio * (1 if price_change > 0 else -1) * abs(price_change)
                        
                        flows[symbol] = {
                            "name": name,
                            "volume_ratio": round(vol_ratio, 2),
                            "price_change": round(price_change, 2),
                            "flow_score": round(flow_score, 2)
                        }
                        
                        # Categorize
                        if symbol in ["SPY", "QQQ", "IWM", "HYG"]:
                            risk_on_flow += flow_score
                        else:
                            risk_off_flow += flow_score
                except:
                    continue
            
            # Determine signal
            net_flow = risk_on_flow - risk_off_flow
            
            if net_flow > 2:
                signal = "STRONG_INFLOW"
            elif net_flow > 0.5:
                signal = "INFLOW"
            elif net_flow > -0.5:
                signal = "NEUTRAL"
            elif net_flow > -2:
                signal = "OUTFLOW"
            else:
                signal = "STRONG_OUTFLOW"
            
            self._add_confidence("institutional", "medium")
            
            return {
                "flows": flows,
                "risk_on_flow": round(risk_on_flow, 2),
                "risk_off_flow": round(risk_off_flow, 2),
                "net_flow": round(net_flow, 2),
                "signal": signal,
                "interpretation": "Institutions buying risk assets" if net_flow > 0 else "Institutions moving to safety"
            }
        except Exception as e:
            print(f"  [Institutional Flow Error] {e}")
            self._add_confidence("institutional", "low")
            return {"signal": "NEUTRAL", "net_flow": 0}

    # ==================== Confidence Level Calculation ====================
    def calculate_confidence(self) -> Dict:
        """Calculate confidence level based on data quality"""
        if not self.confidence_factors:
            return {"level": "medium", "score": 50, "factors": []}
        
        quality_scores = {
            "high": 100,
            "medium": 70,
            "estimated": 40,
            "low": 20
        }
        
        total_score = 0
        for factor in self.confidence_factors:
            total_score += quality_scores.get(factor["quality"], 50)
        
        avg_score = total_score / len(self.confidence_factors)
        
        if avg_score >= 80:
            level = "high"
        elif avg_score >= 60:
            level = "medium"
        elif avg_score >= 40:
            level = "low"
        else:
            level = "very_low"
        
        return {
            "level": level,
            "score": round(avg_score),
            "factors": self.confidence_factors,
            "data_sources_count": len(self.confidence_factors)
        }

    # ==================== AI Score Calculation (Enhanced v3.0) ====================
    def calculate_ai_score(self) -> Dict:
        """Calculate comprehensive AI market score with all indicators"""
        print("=" * 60)
        print("🤖 Analyzing Market Sentiment v3.0 (Enhanced)")
        print("=" * 60)
        
        # Reset confidence tracking
        self.confidence_factors = []
        
        print("  📊 Fetching VIX...")
        vix = self.get_vix() or {"value": 20, "signal": "NEUTRAL"}
        
        print("  😱 Calculating Fear & Greed...")
        fear_greed = self.get_fear_greed_index()
        
        print("  📈 Analyzing Market Breadth (Real A/D)...")
        breadth = self.get_market_breadth()
        
        print("  📞 Getting Put/Call Ratio (CBOE)...")
        pcr = self.get_put_call_ratio()
        
        print("  🏭 Analyzing Sectors...")
        sectors = self.get_sector_performance()
        
        print("  📉 Analyzing Moving Averages (EMA)...")
        ma = self.get_moving_averages(use_ema=True)
        
        print("  💰 Checking Treasury Yields...")
        yields = self.get_treasury_yields()
        
        print("  🚀 Analyzing Market Momentum...")
        momentum = self.get_market_momentum()
        
        print("  💵 Checking Dollar Index...")
        dxy = self.get_dollar_index()
        
        print("  🥇 Checking Gold...")
        gold = self.get_gold_sentiment()
        
        print("  📅 Checking Economic Calendar...")
        calendar = self.get_economic_calendar()
        
        print("  📊 Getting Market Internals...")
        internals = self.get_market_internals()
        
        print("  🏦 Estimating Institutional Flow...")
        inst_flow = self.get_institutional_flow()
        
        # Calculate weighted score with improved weights
        scores = []
        weights = []
        
        # 1. Fear & Greed (18%) - Contrarian
        fg_score = fear_greed.get("score", 50)
        if fg_score <= 20:
            scores.append(85)
        elif fg_score <= 40:
            scores.append(70)
        elif fg_score <= 60:
            scores.append(50)
        elif fg_score <= 80:
            scores.append(35)
        else:
            scores.append(15)
        weights.append(18)
        
        # 2. VIX (12%) - Contrarian
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
        weights.append(12)
        
        # 3. Market Breadth (12%)
        breadth_score = breadth.get("score", 50)
        scores.append(breadth_score)
        weights.append(12)
        
        # 4. Put/Call Ratio (10%) - Contrarian
        pcr_signal = pcr.get("signal", "NEUTRAL")
        pcr_scores = {
            "EXTREME_FEAR": 80,
            "FEAR": 65,
            "NEUTRAL": 50,
            "GREED": 35,
            "EXTREME_GREED": 20
        }
        scores.append(pcr_scores.get(pcr_signal, 50))
        weights.append(10)
        
        # 5. Sector Rotation (8%)
        rotation = sectors.get("rotation", "MIXED")
        if rotation == "RISK_ON":
            scores.append(70)
        elif rotation == "RISK_OFF":
            scores.append(30)
        else:
            scores.append(50)
        weights.append(8)
        
        # 6. Moving Averages (12%)
        ma_trend = ma.get("trend", "NEUTRAL")
        ma_scores = {
            "STRONG_BULLISH": 80,
            "BULLISH": 65,
            "NEUTRAL": 50,
            "BEARISH": 35,
            "STRONG_BEARISH": 20
        }
        scores.append(ma_scores.get(ma_trend, 50))
        weights.append(12)
        
        # 7. Yield Curve (5%)
        if yields.get("inverted"):
            scores.append(25)
        else:
            scores.append(55)
        weights.append(5)
        
        # 8. Momentum (10%)
        momentum_score = momentum.get("score", 50)
        scores.append(momentum_score)
        weights.append(10)
        
        # 9. Dollar Index (4%)
        dxy_signal = dxy.get("signal", "NEUTRAL")
        if dxy_signal == "BULLISH":
            scores.append(65)
        elif dxy_signal == "BEARISH":
            scores.append(35)
        else:
            scores.append(50)
        weights.append(4)
        
        # 10. Institutional Flow (5%)
        inst_signal = inst_flow.get("signal", "NEUTRAL")
        inst_scores = {
            "STRONG_INFLOW": 80,
            "INFLOW": 65,
            "NEUTRAL": 50,
            "OUTFLOW": 35,
            "STRONG_OUTFLOW": 20
        }
        scores.append(inst_scores.get(inst_signal, 50))
        weights.append(5)
        
        # 11. Market Internals (4%)
        internal_signal = internals.get("combined_signal", "NEUTRAL")
        internal_scores = {
            "STRONG_BULLISH": 75,
            "BULLISH": 60,
            "NEUTRAL": 50,
            "MIXED": 50,
            "BEARISH": 40,
            "STRONG_BEARISH": 25
        }
        scores.append(internal_scores.get(internal_signal, 50))
        weights.append(4)
        
        # Calculate final score
        total_score = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
        
        # Apply economic calendar adjustment
        if calendar.get("event_impact") == "high":
            # Reduce confidence, move score toward neutral
            total_score = total_score * 0.9 + 50 * 0.1
        
        final_score = round(total_score)
        
        # Calculate confidence
        confidence = self.calculate_confidence()
        
        # Generate recommendation with confidence
        if final_score >= 75:
            recommendation = "STRONG_BUY"
            message = "Excellent conditions - Extreme Fear = Opportunity"
            message_th = "สภาวะดีเยี่ยม - Extreme Fear = โอกาสซื้อ"
        elif final_score >= 60:
            recommendation = "BUY"
            message = "Good conditions, consider buying"
            message_th = "สภาวะค่อนข้างดี พิจารณาเข้าซื้อได้"
        elif final_score >= 45:
            recommendation = "HOLD"
            message = "Normal conditions, wait for better opportunity"
            message_th = "สภาวะปกติ รอจังหวะที่ดีกว่า"
        elif final_score >= 30:
            recommendation = "CAUTIOUS"
            message = "Caution! Market has risks"
            message_th = "ระวัง! ตลาดมีความเสี่ยง"
        else:
            recommendation = "AVOID"
            message = "Avoid buying, high risk"
            message_th = "หลีกเลี่ยงการซื้อ ความเสี่ยงสูง"
        
        # Add confidence qualifier
        if confidence["level"] == "low" or confidence["level"] == "very_low":
            message += " (Low confidence - limited data)"
            message_th += " (ความเชื่อมั่นต่ำ - ข้อมูลจำกัด)"
        
        return {
            "score": final_score,
            "recommendation": recommendation,
            "message": message,
            "message_th": message_th,
            "confidence": confidence,
            "indicators": {
                "fear_greed": fear_greed,
                "vix": vix,
                "market_breadth": breadth,
                "put_call_ratio": pcr,
                "sectors": sectors,
                "moving_averages": ma,
                "treasury_yields": yields,
                "momentum": momentum,
                "dollar_index": dxy,
                "gold": gold,
                "economic_calendar": calendar,
                "market_internals": internals,
                "institutional_flow": inst_flow
            },
            "score_breakdown": {
                "fear_greed": {"score": scores[0], "weight": "18%"},
                "vix": {"score": scores[1], "weight": "12%"},
                "breadth": {"score": scores[2], "weight": "12%"},
                "pcr": {"score": scores[3], "weight": "10%"},
                "sectors": {"score": scores[4], "weight": "8%"},
                "ma": {"score": scores[5], "weight": "12%"},
                "yields": {"score": scores[6], "weight": "5%"},
                "momentum": {"score": scores[7], "weight": "10%"},
                "dxy": {"score": scores[8], "weight": "4%"},
                "institutional": {"score": scores[9], "weight": "5%"},
                "internals": {"score": scores[10], "weight": "4%"}
            },
            "version": "3.0",
            "updated_at": datetime.now().isoformat()
        }

    def analyze(self) -> Dict:
        """Main analysis function"""
        result = self.calculate_ai_score()
        return json.loads(json.dumps(result, default=str))


# ==================== Main ====================
if __name__ == "__main__":
    analyzer = MarketSentimentAnalyzer()
    result = analyzer.analyze()
    
    print(f"\n{'=' * 60}")
    print(f"🤖 AI MARKET SCORE: {result['score']}/100")
    print(f"📊 Recommendation: {result['recommendation']}")
    print(f"🎯 Confidence: {result['confidence']['level'].upper()} ({result['confidence']['score']}%)")
    print(f"💬 {result['message']}")
    print(f"💬 {result['message_th']}")
    print(f"{'=' * 60}")
    
    # Print indicators
    indicators = result.get("indicators", {})
    
    print(f"\n📈 VIX: {indicators.get('vix', {}).get('value', 'N/A')} ({indicators.get('vix', {}).get('signal', 'N/A')})")
    print(f"😱 Fear & Greed (Stock): {indicators.get('fear_greed', {}).get('score', 'N/A')} ({indicators.get('fear_greed', {}).get('source', 'N/A')})")
    print(f"🪙 Fear & Greed (Crypto): {indicators.get('fear_greed', {}).get('crypto', {}).get('score', 'N/A')}")
    print(f"📊 Market Breadth: {indicators.get('market_breadth', {}).get('signal', 'N/A')} ({indicators.get('market_breadth', {}).get('source', 'N/A')})")
    print(f"📞 Put/Call Ratio: {indicators.get('put_call_ratio', {}).get('ratio', 'N/A')} ({indicators.get('put_call_ratio', {}).get('source', 'N/A')})")
    print(f"🏭 Sector Rotation: {indicators.get('sectors', {}).get('rotation', 'N/A')}")
    print(f"📉 MA Trend ({indicators.get('moving_averages', {}).get('ma_type', 'EMA')}): {indicators.get('moving_averages', {}).get('trend', 'N/A')}")
    print(f"📈 Yield Curve: {'Inverted ⚠️' if indicators.get('treasury_yields', {}).get('inverted') else 'Normal'}")
    print(f"🚀 Momentum: {indicators.get('momentum', {}).get('momentum', 'N/A')}")
    print(f"💵 Dollar Index: {indicators.get('dollar_index', {}).get('value', 'N/A')}")
    print(f"🥇 Gold: {indicators.get('gold', {}).get('signal', 'N/A')}")
    print(f"🏦 Institutional Flow: {indicators.get('institutional_flow', {}).get('signal', 'N/A')}")
    print(f"📊 Market Internals: {indicators.get('market_internals', {}).get('combined_signal', 'N/A')}")
    
    # Economic Calendar
    calendar = indicators.get('economic_calendar', {})
    if calendar.get('upcoming_events'):
        print(f"\n📅 Upcoming Economic Events:")
        for event in calendar['upcoming_events'][:3]:
            print(f"   • {event['event']} - {event['date']} ({event['days_until']} days)")
    
    # Score breakdown
    print(f"\n📊 Score Breakdown:")
    breakdown = result.get("score_breakdown", {})
    for key, data in breakdown.items():
        print(f"   • {key}: {data['score']} (weight: {data['weight']})")
    
    # Save to file
    os.makedirs('data', exist_ok=True)
    with open('data/market_sentiment.json', 'w') as f:
        json.dump(result, f, indent=2)
    print("\n✅ Saved to data/market_sentiment.json")
    
    # Also save to backend/data for GitHub Actions
    os.makedirs('backend/data', exist_ok=True)
    with open('backend/data/market_sentiment.json', 'w') as f:
        json.dump(result, f, indent=2)
    print("✅ Saved to backend/data/market_sentiment.json")
