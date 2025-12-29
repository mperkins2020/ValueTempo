import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function safeJsonParse<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "object") return v as T;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function GET() {
  try {
    const events = await prisma.eventCatalog.findMany({
      orderBy: { event_type: 'asc' },
    })

    const formatted = events.map(event => ({
      event_type: event.event_type,
      description: event.description,
      dimensions: safeJsonParse(event.dimensions, {}),
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

