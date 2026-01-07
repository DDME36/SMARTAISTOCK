"""
SMC Alert Pro - Notification System
====================================
Send alerts via Discord, Telegram, and Web Push
"""

import os
import json
import requests
from datetime import datetime
from typing import Optional, Dict, List


class NotificationSender:
    """Multi-channel notification sender"""
    
    def __init__(self):
        self.discord_url = os.environ.get('DISCORD_WEBHOOK_URL') or os.environ.get('DISCORD_WEBHOOK')
        self.telegram_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        self.telegram_chat_id = os.environ.get('TELEGRAM_CHAT_ID')
        self.ntfy_topic = os.environ.get('NTFY_TOPIC')  # ntfy.sh for mobile push
        
        # Rate limiting
        self._sent_messages = []
        self._max_per_minute = 10
    
    def _can_send(self) -> bool:
        """Check rate limit"""
        now = datetime.now()
        # Remove messages older than 1 minute
        self._sent_messages = [t for t in self._sent_messages if (now - t).seconds < 60]
        return len(self._sent_messages) < self._max_per_minute
    
    def send(self, message: str, priority: str = 'normal') -> bool:
        """
        Send message to all configured channels
        
        Args:
            message: The notification message
            priority: 'low', 'normal', 'high', 'critical'
        """
        if not self._can_send():
            print(f"  [Rate Limited] Skipping: {message[:50]}...")
            return False
        
        self._sent_messages.append(datetime.now())
        print(f"[Notify] {message}")
        
        success = False
        
        # Discord
        if self.discord_url:
            success = self._send_discord(message, priority) or success
        
        # Telegram
        if self.telegram_token and self.telegram_chat_id:
            success = self._send_telegram(message, priority) or success
        
        # ntfy.sh (mobile push)
        if self.ntfy_topic:
            success = self._send_ntfy(message, priority) or success
        
        return success
    
    def _send_discord(self, message: str, priority: str) -> bool:
        """Send to Discord webhook"""
        try:
            # Add emoji based on priority
            emoji = {'critical': '🚨', 'high': '⚠️', 'normal': '📊', 'low': 'ℹ️'}.get(priority, '📊')
            
            payload = {
                "content": f"{emoji} {message}",
                "username": "SMC Alert Pro"
            }
            
            # Use embed for high priority
            if priority in ['critical', 'high']:
                color = 0xFF0000 if priority == 'critical' else 0xFFA500
                payload = {
                    "username": "SMC Alert Pro",
                    "embeds": [{
                        "title": f"{emoji} Alert",
                        "description": message,
                        "color": color,
                        "timestamp": datetime.utcnow().isoformat()
                    }]
                }
            
            resp = requests.post(self.discord_url, json=payload, timeout=10)
            if resp.status_code in [200, 204]:
                print("  [Discord] ✓ Sent")
                return True
            else:
                print(f"  [Discord] ✗ Status {resp.status_code}")
        except Exception as e:
            print(f"  [Discord] ✗ Error: {e}")
        return False
    
    def _send_telegram(self, message: str, priority: str) -> bool:
        """Send to Telegram"""
        try:
            emoji = {'critical': '🚨', 'high': '⚠️', 'normal': '📊', 'low': 'ℹ️'}.get(priority, '📊')
            
            url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
            payload = {
                "chat_id": self.telegram_chat_id,
                "text": f"{emoji} {message}",
                "parse_mode": "HTML",
                "disable_notification": priority == 'low'
            }
            
            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                print("  [Telegram] ✓ Sent")
                return True
            else:
                print(f"  [Telegram] ✗ Status {resp.status_code}")
        except Exception as e:
            print(f"  [Telegram] ✗ Error: {e}")
        return False
    
    def _send_ntfy(self, message: str, priority: str) -> bool:
        """Send to ntfy.sh for mobile push notifications"""
        try:
            ntfy_priority = {'critical': 5, 'high': 4, 'normal': 3, 'low': 2}.get(priority, 3)
            
            resp = requests.post(
                f"https://ntfy.sh/{self.ntfy_topic}",
                data=message.encode('utf-8'),
                headers={
                    "Title": "SMC Alert",
                    "Priority": str(ntfy_priority),
                    "Tags": "chart_with_upwards_trend"
                },
                timeout=10
            )
            
            if resp.status_code == 200:
                print("  [ntfy] ✓ Sent")
                return True
            else:
                print(f"  [ntfy] ✗ Status {resp.status_code}")
        except Exception as e:
            print(f"  [ntfy] ✗ Error: {e}")
        return False
    
    def send_summary(self, summary: Dict) -> bool:
        """Send daily summary"""
        lines = [
            "📊 <b>SMC Alert Pro - Daily Summary</b>",
            "",
            f"🎯 Stocks Analyzed: {summary.get('total_stocks', 0)}",
            f"⚠️ Total Alerts: {summary.get('total_alerts', 0)}",
            f"📈 Sentiment: {summary.get('sentiment_score', 50)}/100",
            f"💡 Recommendation: {summary.get('recommendation', 'HOLD')}",
        ]
        
        bias = summary.get('market_bias', {})
        lines.append(f"📊 Market: 🟢{bias.get('bullish', 0)} 🔴{bias.get('bearish', 0)} 🟡{bias.get('neutral', 0)}")
        
        buy_opps = summary.get('top_buy_opportunities', [])
        if buy_opps:
            lines.append("")
            lines.append("🎯 <b>Top BUY:</b>")
            for opp in buy_opps[:3]:
                lines.append(f"  • {opp['symbol']}")
        
        return self.send("\n".join(lines), priority='normal')


if __name__ == "__main__":
    sender = NotificationSender()
    sender.send("🧪 Test Notification from SMC Alert Pro", priority='high')
