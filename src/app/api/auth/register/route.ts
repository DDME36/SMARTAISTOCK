import { NextRequest, NextResponse } from 'next/server'
import { register, setAuthCookie } from '@/lib/auth'
import { initDatabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    await initDatabase()
    
    const { username, password } = await request.json()
    
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
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
