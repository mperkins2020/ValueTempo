import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const segments = await prisma.segmentCatalog.findMany({
      orderBy: { segment_id: 'asc' },
    })

    return NextResponse.json(segments)
  } catch (error) {
    console.error('Error fetching segments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

