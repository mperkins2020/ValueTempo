import { prisma } from "../lib/prisma";
import * as fs from 'fs'
import * as path from 'path'


async function main() {
  console.log('Starting seed...')

  const seedDir = path.join(process.cwd(), 'seed')

  // Helper function to load JSON files
  function loadJson<T>(filename: string): T {
    const filePath = path.join(seedDir, filename)
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as T
  }

  // Seed Workspaces
  console.log('Seeding workspaces...')
  const workspaces = loadJson<Array<{ workspace_id: string; workspace_name: string; created_at: string }>>('workspaces.json')
  for (const workspace of workspaces) {
    await prisma.workspace.upsert({
      where: { workspace_id: workspace.workspace_id },
      update: {},
      create: {
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        created_at: new Date(workspace.created_at),
      },
    })
  }

  // Seed Cycles
  console.log('Seeding cycles...')
  const cycles = loadJson<Array<{
    cycle_id: string
    workspace_id: string
    cycle_type: string
    period_length_days: number
    start_date: string
    end_date: string
    goal_type: string | null
    primary_metrics: string[]
    segments: string[]
    narrative?: string | null
  }>>('cycles.json')
  for (const cycle of cycles) {
    await prisma.cycle.upsert({
      where: { cycle_id: cycle.cycle_id },
      update: {},
      create: {
        cycle_id: cycle.cycle_id,
        workspace_id: cycle.workspace_id,
        cycle_type: cycle.cycle_type as any,
        period_length_days: cycle.period_length_days,
        start_date: cycle.start_date,
        end_date: cycle.end_date,
        goal_type: cycle.goal_type as any,
        primary_metrics: JSON.stringify(cycle.primary_metrics),
        segments: JSON.stringify(cycle.segments),
        narrative: cycle.narrative || null,
        created_at: new Date(),
      },
    })
  }

  // Seed EventCatalog
  console.log('Seeding event catalog...')
  const eventCatalog = loadJson<Array<{ event_type: string; description: string; dimensions: string[] }>>('event_catalog.json')
  for (const event of eventCatalog) {
    await prisma.eventCatalog.upsert({
      where: { event_type: event.event_type },
      update: {},
      create: {
        event_type: event.event_type,
        description: event.description,
        dimensions: JSON.stringify(event.dimensions),
      },
    })
  }

  // Seed MetricCatalog
  console.log('Seeding metric catalog...')
  const metricCatalog = loadJson<Array<{ metric_id: string; label: string; type: string }>>('metric_catalog.json')
  for (const metric of metricCatalog) {
    await prisma.metricCatalog.upsert({
      where: { metric_id: metric.metric_id },
      update: {},
      create: {
        metric_id: metric.metric_id,
        label: metric.label,
        type: metric.type,
      },
    })
  }

  // Seed QualitySignalCatalog
  console.log('Seeding quality signal catalog...')
  const qualitySignalCatalog = loadJson<Array<{ signal_id: string; label: string; source: string }>>('quality_signal_catalog.json')
  for (const signal of qualitySignalCatalog) {
    await prisma.qualitySignalCatalog.upsert({
      where: { signal_id: signal.signal_id },
      update: {},
      create: {
        signal_id: signal.signal_id,
        label: signal.label,
        source: signal.source,
      },
    })
  }

  // Seed SegmentCatalog (extract from customers and cycles)
  console.log('Seeding segment catalog...')
  const customers = loadJson<Array<{ customer_id: string; name: string; segment_id: string }>>('customers.json')
  const segments = new Set<string>()
  customers.forEach(c => segments.add(c.segment_id))
  cycles.forEach(c => c.segments.forEach(s => segments.add(s)))
  
  for (const segmentId of segments) {
    await prisma.segmentCatalog.upsert({
      where: { segment_id: segmentId },
      update: {},
      create: {
        segment_id: segmentId,
        label: segmentId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: null,
        created_at: new Date(),
      },
    })
  }

  // Seed Customers
  console.log('Seeding customers...')
  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { customer_id: customer.customer_id },
      update: {},
      create: {
        customer_id: customer.customer_id,
        name: customer.name,
        segment_id: customer.segment_id,
        created_at: new Date(),
      },
    })
  }

  // Seed ValueUnitDefinitions
  console.log('Seeding value units...')
  const valueUnits = loadJson<Array<{
    value_unit_id: string
    cycle_id: string
    name: string
    unit_type: string
    event_mapping: any
    outcome_statement: string
    quality_signal_source: string[]
    quality_note?: string | null
    unit_economics: any
    metrics_intent: Array<{ metric_id: string; expected_impact: string }>
  }>>('value_units.json')
  for (const vu of valueUnits) {
    await prisma.valueUnitDefinition.upsert({
      where: { value_unit_id: vu.value_unit_id },
      update: {},
      create: {
        value_unit_id: vu.value_unit_id,
        cycle_id: vu.cycle_id,
        name: vu.name,
        unit_type: vu.unit_type,
        event_mapping: JSON.stringify(vu.event_mapping),
        outcome_statement: vu.outcome_statement,
        quality_signal_source: JSON.stringify(vu.quality_signal_source),
        quality_note: vu.quality_note || null,
        unit_economics: JSON.stringify(vu.unit_economics),
        metrics_intent: JSON.stringify(vu.metrics_intent),
        completeness_status: 'green' as any,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })
  }

  // Seed ValueUnitSnapshots
  console.log('Seeding value unit snapshots...')
  const valueUnitSnapshots = loadJson<Array<{
    value_unit_snapshot_id: string
    cycle_id: string
    snapshot_version: number
    created_at: string
    value_unit_ids: string[]
  }>>('value_unit_snapshots.json')
  for (const vus of valueUnitSnapshots) {
    await prisma.valueUnitSnapshot.upsert({
      where: { value_unit_snapshot_id: vus.value_unit_snapshot_id },
      update: {},
      create: {
        value_unit_snapshot_id: vus.value_unit_snapshot_id,
        cycle_id: vus.cycle_id,
        version: vus.snapshot_version,
        value_unit_ids: JSON.stringify(vus.value_unit_ids),
        created_at: new Date(vus.created_at),
      },
    })
  }

  // Seed ConfigVersions
  console.log('Seeding config versions...')
  const configs = loadJson<Array<{
    config_version_id: string
    workspace_id: string
    cycle_id: string
    segment: string
    stage: string
    target_environment: string
    version: number
    status: string
    effective_at: string
    value_unit_snapshot_version: number
    pools: any[]
    exploration: any
    rails: any
  }>>('configs.json')
  for (const config of configs) {
    await prisma.configVersion.upsert({
      where: { config_version_id: config.config_version_id },
      update: {},
      create: {
        config_version_id: config.config_version_id,
        cycle_id: config.cycle_id,
        workspace_id: config.workspace_id,
        segment: config.segment,
        stage: config.stage as any,
        target_environment: config.target_environment as any,
        version: config.version,
        status: config.status as any,
        effective_at: new Date(config.effective_at),
        pools: JSON.stringify(config.pools),
        exploration: JSON.stringify(config.exploration),
        rails: JSON.stringify(config.rails),
        billing_patch_id: null,
        value_unit_snapshot_version: config.value_unit_snapshot_version,
        price_book_ref: 'usd_2026_01_default',
        created_at: new Date(),
        updated_at: new Date(),
      },
    })
  }

  // Seed SimulationRuns
  console.log('Seeding simulation runs...')
  const simulationRuns = loadJson<Array<{
    simulation_run_id: string
    config_version_id: string
    baseline_config_version_id: string | null
    inputs: any
    outputs: any
    created_at: string
  }>>('simulation_runs.json')
  for (const sim of simulationRuns) {
    await prisma.simulationRun.upsert({
      where: { simulation_run_id: sim.simulation_run_id },
      update: {},
      create: {
        simulation_run_id: sim.simulation_run_id,
        config_version_id: sim.config_version_id,
        baseline_config_version_id: sim.baseline_config_version_id || null,
        input: JSON.stringify(sim.inputs),
        output: JSON.stringify(sim.outputs),
        completeness_result: 'green' as any,
        created_at: new Date(sim.created_at),
      },
    })
  }

  // Seed BillingPatches
  console.log('Seeding billing patches...')
  const billingPatches = loadJson<Array<{
    billing_patch_id: string
    workspace_id: string
    cycle_id: string
    config_version_id: string
    price_book_ref: string
    payload: any
    created_at: string
  }>>('billing_patches.json')
  for (const bp of billingPatches) {
    await prisma.billingPatch.upsert({
      where: { billing_patch_id: bp.billing_patch_id },
      update: {},
      create: {
        billing_patch_id: bp.billing_patch_id,
        config_version_id: bp.config_version_id,
        workspace_id: bp.workspace_id,
        cycle_id: bp.cycle_id,
        price_book_ref: bp.price_book_ref,
        effective_at: new Date(bp.created_at),
        payload: JSON.stringify(bp.payload),
        created_at: new Date(bp.created_at),
      },
    })
  }

  // Seed DecisionRecords
  console.log('Seeding decision records...')
  const decisionRecords = loadJson<Array<{
    decision_id: string
    workspace_id: string
    cycle_id: string
    config_version_id: string
    baseline_config_version_id: string | null
    simulation_run_id: string
    billing_patch_id: string
    subject_resolution: any
    status: string
    approver_name: string
    approver_role: string
    rationale: string
    effective_at: string
    created_at: string
    value_unit_snapshot_version: number
    diff: any
  }>>('decision_records.json')
  for (const dr of decisionRecords) {
    await prisma.decisionRecord.upsert({
      where: { decision_id: dr.decision_id },
      update: {},
      create: {
        decision_id: dr.decision_id,
        config_version_id: dr.config_version_id,
        cycle_id: dr.cycle_id,
        baseline_config_version_id: dr.baseline_config_version_id || null,
        billing_patch_id: dr.billing_patch_id,
        subject_resolution: JSON.stringify(dr.subject_resolution),
        value_unit_snapshot_version: dr.value_unit_snapshot_version,
        approver_name: dr.approver_name,
        approver_role: dr.approver_role,
        rationale: dr.rationale,
        diff: JSON.stringify(dr.diff),
        simulation_run_id: dr.simulation_run_id,
        effective_at: new Date(dr.effective_at),
        created_at: new Date(dr.created_at),
      },
    })
  }

  console.log('Seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

