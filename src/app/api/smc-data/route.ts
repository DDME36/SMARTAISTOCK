import { NextResponse } from 'next/server'

// Fetch latest SMC data from GitHub raw (bypasses Vercel cache)
export async function GET() {
  try {
    const githubRawUrl = 'https://raw.githubusercontent.com/DDME36/SMARTAISTOCK/main/public/data/smc_data.json'
    
    // Add timestamp to bypass any caching
    const res = await fetch(`${githubRawUrl}?t=${Date.now()}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
    
    if (!res.ok) {
      console.error('GitHub fetch failed:', res.status, res.statusText)
      return NextResponse.json({ error: 'Failed to fetch from GitHub' }, { status: 500 })
    }
    
    const data = await res.json()
    
    // Log for debugging
    console.log('SMC data fetched, generated_at:', data?.generated_at)
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('Error fetching SMC data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
