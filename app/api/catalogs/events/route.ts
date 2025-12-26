import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const events = await prisma.eventCatalog.findMany({
      orderBy: { event_type: 'asc' },
    })

    const formatted = events.map(event => ({
      event_type: event.event_type,
      description: event.description,
      dimensions: JSON.parse(event.dimensions),
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

