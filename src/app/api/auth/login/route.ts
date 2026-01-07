import { NextRequest, NextResponse } from 'next/server'
import { login, setAuthCookie } from '@/lib/auth'
import { initDatabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    await initDatabase()
    
    const { username, password } = await request.json()
    
    const result = await login(username, password)
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }
    
    await setAuthCookie(result.token!)
    
    return NextResponse.json({ 
      user: result.user,
      message: 'Login successful'
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
