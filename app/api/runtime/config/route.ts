import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const workspace_id = searchParams.get('workspace_id')
    const segment = searchParams.get('segment')
    const stage = searchParams.get('stage')
    const target_environment = searchParams.get('target_environment')

    if (!workspace_id || !segment || !stage || !target_environment) {
      return NextResponse.json(
        { error: 'Missing required query parameters: workspace_id, segment, stage, target_environment' },
        { status: 400 }
      )
    }

    // Find active config matching subject_resolution
    const config = await prisma.configVersion.findFirst({
      where: {
        workspace_id,
        segment,
        stage: stage as any,
        target_environment: target_environment as any,
        status: 'active',
      },
      include: {
        cycle: true,
      },
    })

    // Get the decision record that activated this config
    const decisionRecord = await prisma.decisionRecord.findFirst({
      where: {
        config_version_id: config?.config_version_id,
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    if (!config) {
      return NextResponse.json(
        { error: 'No active config found for the given subject_resolution' },
        { status: 404 }
      )
    }

    // Get value units for this cycle
    const valueUnits = await prisma.valueUnitDefinition.findMany({
      where: {
        cycle_id: config.cycle_id,
      },
    })

    // Parse JSON fields
    const pools = JSON.parse(config.pools)
    const exploration = JSON.parse(config.exploration)
    const rails = JSON.parse(config.rails)
    const cyclePrimaryMetrics = JSON.parse(config.cycle.primary_metrics)

    // Build value_units array
    const valueUnitsArray = valueUnits.map(vu => ({
      value_unit_id: vu.value_unit_id,
      name: vu.name,
      event_mapping: JSON.parse(vu.event_mapping),
      metrics_intent: JSON.parse(vu.metrics_intent),
      quality_signal_source: JSON.parse(vu.quality_signal_source),
      unit_economics: JSON.parse(vu.unit_economics),
    }))

    // Build avs_config response
    const avs_config = {
      avs_version: 'v2.0',
      cycle_id: config.cycle_id,
      config_version_id: config.config_version_id,
      effective_at: config.effective_at.toISOString(),
      north_star: {
        goal_type: config.cycle.goal_type || null,
        primary_metrics: cyclePrimaryMetrics,
        narrative: config.cycle.narrative || null,
      },
      subject_resolution: {
        workspace_id: config.workspace_id,
        segment: config.segment,
        stage: config.stage,
        target_environment: config.target_environment,
      },
      quality_mode: 'advisory',
      value_units: valueUnitsArray,
      pools: pools,
      exploration: exploration,
      rails: rails,
      rating_agility: {
        price_book_ref: config.price_book_ref,
      },
      metric_lenses: ['exploration_depth', 'gross_margin'],
      governance: {
        config_version_id: config.config_version_id,
        approval_ref: decisionRecord?.decision_id || null,
        config_status: config.status,
        audit: decisionRecord ? [
          {
            type: 'approved',
            by: `${decisionRecord.approver_name}, ${decisionRecord.approver_role}`,
            at: decisionRecord.created_at.toISOString(),
          },
        ] : [],
      },
      generated_at: new Date().toISOString(),
      source: 'avs_brain_operator_ui',
    }

    return NextResponse.json(avs_config)
  } catch (error) {
    console.error('Error fetching runtime config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

