import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const WATCHLIST_PATH = path.join(process.cwd(), 'public/data/watchlist.json')

export async function GET() {
  try {
    const data = await fs.readFile(WATCHLIST_PATH, 'utf-8')
    return NextResponse.json(JSON.parse(data))
  } catch {
    return NextResponse.json({ symbols: [], interval: '1h', updated_at: new Date().toISOString() })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = {
      symbols: body.symbols || [],
      interval: body.interval || '1h',
      updated_at: new Date().toISOString()
    }
    
    await fs.writeFile(WATCHLIST_PATH, JSON.stringify(data, null, 2))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
