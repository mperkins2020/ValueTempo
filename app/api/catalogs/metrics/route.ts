import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const metrics = await prisma.metricCatalog.findMany({
      orderBy: { metric_id: 'asc' },
    })

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

