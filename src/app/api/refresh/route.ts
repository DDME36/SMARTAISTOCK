import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: 'Only available in development mode' },
      { status: 403 }
    )
  }

  try {
    const backendPath = path.join(process.cwd(), 'backend')
    
    // Run Python analysis
    const { stdout, stderr } = await execAsync('python run_analysis.py', {
      cwd: backendPath,
      timeout: 120000 // 2 minutes timeout
    })

    console.log('Analysis output:', stdout)
    if (stderr) console.error('Analysis stderr:', stderr)

    return NextResponse.json({
      success: true,
      message: 'Analysis completed',
      output: stdout.slice(-500) // Last 500 chars
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
