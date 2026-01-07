import { NextRequest, NextResponse } from 'next/server'
import { register, setAuthCookie } from '@/lib/auth'
import { initDatabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    await initDatabase()
    
    const body = await request.json()
    const { username, password } = body
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }
    
    const result = await register(username, password)
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    await setAuthCookie(result.token!)
    
    return NextResponse.json({ 
      user: result.user,
      message: 'Registration successful'
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ 
      error: 'Registration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
