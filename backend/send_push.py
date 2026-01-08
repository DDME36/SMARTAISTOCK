#!/usr/bin/env python3
"""
Send push notifications for Order Block entries
Called by GitHub Actions after SMC analysis
"""

import os
import json
import requests

def send_push_notifications():
    """Send push notifications for OB entry alerts"""
    
    # Load SMC data
    smc_file = os.path.join(os.path.dirname(__file__), 'data', 'smc_data.json')
    
    if not os.path.exists(smc_file):
        print("No SMC data file found")
        return
    
    with open(smc_file, 'r') as f:
        smc_data = json.load(f)
    
    # Collect OB entry alerts
    alerts = []
    stocks = smc_data.get('stocks', {})
    
    for symbol, data in stocks.items():
        stock_alerts = data.get('alerts', [])
        
        for alert in stock_alerts:
            # Only send for OB entry alerts
            if alert.get('type', '').startswith('ob_entry_'):
                alerts.append({
                    'symbol': symbol,
                    'type': alert.get('type'),
                    'message': alert.get('message'),
                    'signal': alert.get('signal'),
                    'ob_high': alert.get('ob_high'),
                    'ob_low': alert.get('ob_low')
                })
    
    if not alerts:
        print("No OB entry alerts to send")
        return
    
    print(f"Found {len(alerts)} OB entry alerts")
    
    # Send to push API
    api_url = os.environ.get('VERCEL_URL', 'https://smartaistock.vercel.app')
    api_key = os.environ.get('INTERNAL_API_KEY')
    
    if not api_key:
        print("INTERNAL_API_KEY not set, skipping push notifications")
        return
    
    try:
        response = requests.post(
            f"{api_url}/api/push/send",
            json={'alerts': alerts},
            headers={
                'Content-Type': 'application/json',
                'x-api-key': api_key
            },
            timeout=30
        )
        
        if response.ok:
            result = response.json()
            print(f"Push notifications sent: {result.get('sent', 0)} success, {result.get('failed', 0)} failed")
        else:
            print(f"Push API error: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"Failed to send push notifications: {e}")

if __name__ == '__main__':
    send_push_notifications()
