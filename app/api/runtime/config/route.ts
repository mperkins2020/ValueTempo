import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Stage = "learning" | "scaling";
type TargetEnvironment = "sandbox" | "production";

function isStage(v: string | null): v is Stage {
  return v === "learning" || v === "scaling";
}

function isTargetEnvironment(v: string | null): v is TargetEnvironment {
  return v === "sandbox" || v === "production";
}

// Prisma Json fields might be stored as Json or as string depending on schema/migrations.
// This makes the route resilient either way.
function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspace_id = searchParams.get("workspace_id");
    const segment = searchParams.get("segment");
    const stageRaw = searchParams.get("stage");
    const targetEnvRaw = searchParams.get("target_environment");

    if (!workspace_id || !segment || !stageRaw || !targetEnvRaw) {
      return NextResponse.json(
        {
          error:
            "Missing required query parameters: workspace_id, segment, stage, target_environment",
        },
        { status: 400 },
      );
    }

    if (!isStage(stageRaw)) {
      return NextResponse.json(
        { error: "Invalid stage. Must be: learning, scaling" },
        { status: 400 },
      );
    }

    if (!isTargetEnvironment(targetEnvRaw)) {
      return NextResponse.json(
        { error: "Invalid target_environment. Must be: sandbox, production" },
        { status: 400 },
      );
    }

    // 1) Find active config matching subject_resolution
    const config = await prisma.configVersion.findFirst({
      where: {
        workspace_id,
        segment,
        stage: stageRaw,
        target_environment: targetEnvRaw,
        status: "active",
      },
      include: {
        cycle: true,
      },
      orderBy: {
        effective_at: "desc",
      },
    });

    if (!config) {
      return NextResponse.json(
        {
          error: "No active config found for the given subject_resolution",
          subject_resolution: {
            workspace_id,
            segment,
            stage: stageRaw,
            target_environment: targetEnvRaw,
          },
        },
        { status: 404 },
      );
    }

    // 2) Parse JSON fields safely (works for Prisma Json or string)
    const pools = asJson<any[]>(config.pools, []);
    const exploration = asJson<any>(config.exploration, { enabled: false });
    const rails = asJson<any>(config.rails, {});
    const cyclePrimaryMetrics = asJson<string[]>(config.cycle.primary_metrics, []);

    // 3) Fetch only pooled value units (more deterministic runtime payload)
    const pooledValueUnitIds = Array.from(
      new Set(
        pools
          .map((p) => p?.value_unit_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    const valueUnits = pooledValueUnitIds.length
      ? await prisma.valueUnitDefinition.findMany({
          where: {
            cycle_id: config.cycle_id,
            value_unit_id: { in: pooledValueUnitIds },
          },
          orderBy: { value_unit_id: "asc" },
        })
      : [];

    // 4) Get the MOST RECENT decision record that activated this config
    // Order by created_at desc to get the latest decision
    const decisionRecord = await prisma.decisionRecord.findFirst({
      where: {
        config_version_id: config.config_version_id,
      },
      orderBy: { created_at: "desc" },
    });


    const valueUnitsArray = valueUnits.map((vu) => ({
      value_unit_id: vu.value_unit_id,
      name: vu.name,
      unit_type: vu.unit_type,
      event_mapping: asJson(vu.event_mapping, {}),
      outcome_statement: vu.outcome_statement,
      metrics_intent: asJson(vu.metrics_intent, []),
      quality_signal_source: asJson(vu.quality_signal_source, []),
      quality_note: vu.quality_note ?? undefined,
      unit_economics: asJson(vu.unit_economics, null),
    }));

    // 5) Build avs_config response aligned to Build Pack Prompt
    const avs_config = {
      avs_version: "v0.5.1",
      cycle_id: config.cycle_id,
      config_version_id: config.config_version_id,
      effective_at:
        config.effective_at instanceof Date
          ? config.effective_at.toISOString()
          : new Date(config.effective_at as any).toISOString(),
      north_star: {
        goal_type: config.cycle.goal_type,
        primary_metrics: cyclePrimaryMetrics,
        narrative: config.cycle.narrative ?? undefined,
      },
      subject_resolution: {
        workspace_id: config.workspace_id,
        segment: config.segment,
        stage: config.stage,
        target_environment: config.target_environment,
      },
      quality_mode: "advisory",
      value_units: valueUnitsArray,
      pools,
      exploration,
      rails,
      rating_agility: { price_book_ref: config.price_book_ref },
      // MVP: keep metric_lenses deterministic. Later derive from Cycle/Config.
      metric_lenses: ["exploration_depth", "margin_floor_violations"],
      governance: {
        config_version_id: config.config_version_id,
        approval_ref: decisionRecord?.decision_id ?? null,
        config_status: config.status,
        audit: decisionRecord
          ? [
              {
                type: "approved",
                by: `${decisionRecord.approver_name}, ${decisionRecord.approver_role}`,
                at:
                  decisionRecord.created_at instanceof Date
                    ? decisionRecord.created_at.toISOString()
                    : new Date(decisionRecord.created_at as any).toISOString(),
              },
            ]
          : [],
      },
      generated_at: new Date().toISOString(),
      source: "avs_brain_operator_ui",
    };

    return NextResponse.json(avs_config);
  } catch (error) {
    console.error("Error fetching runtime config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

