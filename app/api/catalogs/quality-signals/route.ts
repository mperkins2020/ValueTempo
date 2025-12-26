import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const signals = await prisma.qualitySignalCatalog.findMany({
      orderBy: { signal_id: 'asc' },
    })

    return NextResponse.json(signals)
  } catch (error) {
    console.error('Error fetching quality signals:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

