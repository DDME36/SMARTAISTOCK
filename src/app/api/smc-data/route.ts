import { NextResponse } from 'next/server'

// Fetch latest SMC data from GitHub raw (bypasses Vercel cache)
export async function GET() {
  try {
    const githubRawUrl = 'https://raw.githubusercontent.com/DDME36/SMARTAISTOCK/main/public/data/smc_data.json'
    
    const res = await fetch(githubRawUrl, {
      next: { revalidate: 60 }, // Revalidate every 60 seconds
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
    
    if (!res.ok) {
      // Fallback to local file
      return NextResponse.json({ error: 'Failed to fetch from GitHub' }, { status: 500 })
    }
    
    const data = await res.json()
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Error fetching SMC data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
