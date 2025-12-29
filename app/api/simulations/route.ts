import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSimulation } from "@/lib/simulation/engine";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body. Send application/json." },
        { status: 400 }
      );
    }

    const {
      candidate_config_version_id,
      baseline_config_version_id,
      historical_window_days,
      filters,
      pricing_mode = "use_unit_economics",
      include_exploration_in_results = true,
      annual_churn_rate,
      churn_horizon_months,
      segment_customer_count: segment_customer_count_override,
      pool_pricing_mode_overrides,
      commit_semantics = "commit_floor",
      pool_commit_semantics_overrides,
    } = body as any;

    if (!candidate_config_version_id || !historical_window_days || !filters) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: candidate_config_version_id, historical_window_days, filters",
        },
        { status: 400 }
      );
    }

    // Validate pricing_mode
    const validPricingModes = ["use_unit_economics", "revenue_proxy_total", "revenue_proxy_commit"];
    if (pricing_mode && !validPricingModes.includes(pricing_mode)) {
      return NextResponse.json(
        {
          error: `Invalid pricing_mode. Must be one of: ${validPricingModes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate pool_pricing_mode_overrides
    if (pool_pricing_mode_overrides) {
      if (typeof pool_pricing_mode_overrides !== "object" || Array.isArray(pool_pricing_mode_overrides)) {
        return NextResponse.json(
          {
            error: "pool_pricing_mode_overrides must be an object with pool_id keys and pricing_mode values",
          },
          { status: 400 }
        );
      }
      for (const [poolId, mode] of Object.entries(pool_pricing_mode_overrides)) {
        if (!validPricingModes.includes(mode as string)) {
          return NextResponse.json(
            {
              error: `Invalid pricing_mode "${mode}" for pool "${poolId}". Must be one of: ${validPricingModes.join(", ")}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Validate commit_semantics
    const validCommitSemantics = ["commit_floor", "entitlement_only"];
    if (commit_semantics && !validCommitSemantics.includes(commit_semantics)) {
      return NextResponse.json(
        {
          error: `Invalid commit_semantics. Must be one of: ${validCommitSemantics.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate pool_commit_semantics_overrides
    if (pool_commit_semantics_overrides) {
      if (typeof pool_commit_semantics_overrides !== "object" || Array.isArray(pool_commit_semantics_overrides)) {
        return NextResponse.json(
          {
            error: "pool_commit_semantics_overrides must be an object with pool_id keys and commit_semantics values",
          },
          { status: 400 }
        );
      }
      for (const [poolId, semantics] of Object.entries(pool_commit_semantics_overrides)) {
        if (!validCommitSemantics.includes(semantics as string)) {
          return NextResponse.json(
            {
              error: `Invalid commit_semantics "${semantics}" for pool "${poolId}". Must be one of: ${validCommitSemantics.join(", ")}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Fetch candidate config
    const candidate = await prisma.configVersion.findUnique({
      where: { config_version_id: candidate_config_version_id },
      include: { cycle: true },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: `Candidate config not found: ${candidate_config_version_id}` },
        { status: 404 }
      );
    }

    // Fetch baseline config if provided
    const baselineId =
      baseline_config_version_id && baseline_config_version_id !== "none"
        ? baseline_config_version_id
        : null;

    const baseline = baselineId
      ? await prisma.configVersion.findUnique({
          where: { config_version_id: baselineId },
          include: { cycle: true },
        })
      : null;

    // Fetch value units for the candidate cycle (and baseline cycle if different)
    const candidateVUs = await prisma.valueUnitDefinition.findMany({
      where: { cycle_id: candidate.cycle_id },
    });

    const baselineVUs =
      baseline && baseline.cycle_id !== candidate.cycle_id
        ? await prisma.valueUnitDefinition.findMany({
            where: { cycle_id: baseline.cycle_id },
          })
        : candidateVUs;

    // Get segment customer count for scaling (allow override from request)
    let segment_customer_count: number;
    if (segment_customer_count_override !== undefined) {
      segment_customer_count = segment_customer_count_override > 0 ? segment_customer_count_override : 1;
    } else {
      const segment_customer_count_raw = await prisma.customer.count({
        where: { segment_id: filters.segment },
      });
      segment_customer_count = segment_customer_count_raw > 0 ? segment_customer_count_raw : 1;
    }

    const simOutput = await runSimulation({
      candidate,
      candidateValueUnits: candidateVUs,
      baseline: baseline ?? undefined,
      baselineValueUnits: baselineVUs,
      historical_window_days,
      filters,
      pricing_mode,
      include_exploration_in_results,
      segment_customer_count,
      annual_churn_rate,
      churn_horizon_months,
      pool_pricing_mode_overrides: pool_pricing_mode_overrides as Record<string, "use_unit_economics" | "revenue_proxy_total" | "revenue_proxy_commit"> | undefined,
      commit_semantics: commit_semantics as "commit_floor" | "entitlement_only",
      pool_commit_semantics_overrides: pool_commit_semantics_overrides as Record<string, "commit_floor" | "entitlement_only"> | undefined,
    });

    // Persist SimulationRun
    const simulation_run_id = `sim_${randomUUID()}`;

    const completeness_result: "green" | "amber" | "red" =
      simOutput.blocking_issues?.length
        ? "red"
        : simOutput.risks?.length
          ? "amber"
          : "green";

    const created = await prisma.simulationRun.create({
      data: {
        simulation_run_id,
        config_version_id: candidate.config_version_id,
        baseline_config_version_id: baseline?.config_version_id ?? null,
        input: JSON.stringify({
          historical_window_days,
          filters,
          pricing_mode,
          include_exploration_in_results,
          segment_customer_count,
          // Store resolved churn values from simulation output
          annual_churn_rate: simOutput.economics_summary.assumptions?.annual_churn_rate,
          monthly_churn_rate: simOutput.economics_summary.assumptions?.monthly_churn_rate,
          churn_horizon_months: simOutput.economics_summary.assumptions?.churn_horizon_months ?? 12,
          pool_pricing_mode_overrides: pool_pricing_mode_overrides || undefined,
          commit_semantics: commit_semantics || "commit_floor",
          pool_commit_semantics_overrides: pool_commit_semantics_overrides || undefined,
        }),
        output: JSON.stringify(simOutput),
        completeness_result,
      },
    });

    return NextResponse.json({
      simulation_run_id: created.simulation_run_id,
      candidate_config_version_id: candidate.config_version_id,
      baseline_config_version_id: baseline?.config_version_id ?? null,
      output: simOutput,
      completeness_result: created.completeness_result,
    });
  } catch (err: any) {
    console.error("Simulations API error:", err);

    const dev = process.env.NODE_ENV !== "production";

    return NextResponse.json(
      {
        error: "Internal server error",
        details: dev ? (err?.message ?? String(err)) : undefined,
        stack: dev ? (err?.stack ?? undefined) : undefined,
      },
      { status: 500 }
    );
  }
}

/*
 * Example curl commands for each pricing_mode:
 *
 * 1. use_unit_economics (default): Revenue = overage_units * target_price_per_unit_usd
 *    curl -X POST "http://localhost:3000/api/simulations" \
 *      -H "Content-Type: application/json" \
 *      -d '{
 *        "candidate_config_version_id": "cfg_smb_learning_prod_v2_candidate",
 *        "baseline_config_version_id": "cfg_smb_learning_prod_v1",
 *        "historical_window_days": 30,
 *        "filters": {
 *          "workspace_id": "ws_1049",
 *          "segment": "ai_video_smb",
 *          "stage": "learning",
 *          "target_environment": "production"
 *        },
 *        "pricing_mode": "use_unit_economics",
 *        "include_exploration_in_results": false
 *      }'
 *
 * 2. revenue_proxy_total: Revenue = total_units * target_price_per_unit_usd
 *    curl -X POST "http://localhost:3000/api/simulations" \
 *      -H "Content-Type: application/json" \
 *      -d '{
 *        "candidate_config_version_id": "cfg_smb_learning_prod_v2_candidate",
 *        "baseline_config_version_id": "cfg_smb_learning_prod_v1",
 *        "historical_window_days": 30,
 *        "filters": {
 *          "workspace_id": "ws_1049",
 *          "segment": "ai_video_smb",
 *          "stage": "learning",
 *          "target_environment": "production"
 *        },
 *        "pricing_mode": "revenue_proxy_total",
 *        "include_exploration_in_results": false
 *      }'
 *
 * 3. revenue_proxy_commit: Revenue = max(included_units, total_units) * target_price_per_unit_usd
 *    curl -X POST "http://localhost:3000/api/simulations" \
 *      -H "Content-Type: application/json" \
 *      -d '{
 *        "candidate_config_version_id": "cfg_smb_learning_prod_v2_candidate",
 *        "baseline_config_version_id": "cfg_smb_learning_prod_v1",
 *        "historical_window_days": 30,
 *        "filters": {
 *          "workspace_id": "ws_1049",
 *          "segment": "ai_video_smb",
 *          "stage": "learning",
 *          "target_environment": "production"
 *        },
 *        "pricing_mode": "revenue_proxy_commit",
 *        "include_exploration_in_results": false
 *      }'
 *
 * Example curl commands for commit semantics:
 *
 * A) Global commit_floor, pool_4k commit_floor:
 *    curl -X POST "http://localhost:3000/api/simulations" \
 *      -H "Content-Type: application/json" \
 *      -d '{
 *        "candidate_config_version_id": "cfg_smb_learning_prod_v2_candidate",
 *        "baseline_config_version_id": "cfg_smb_learning_prod_v1",
 *        "historical_window_days": 30,
 *        "filters": {
 *          "workspace_id": "ws_1049",
 *          "segment": "ai_video_smb",
 *          "stage": "learning",
 *          "target_environment": "production"
 *        },
 *        "pricing_mode": "revenue_proxy_commit",
 *        "commit_semantics": "commit_floor",
 *        "pool_pricing_mode_overrides": {
 *          "pool_4k": "revenue_proxy_commit"
 *        },
 *        "pool_commit_semantics_overrides": {
 *          "pool_4k": "commit_floor"
 *        },
 *        "include_exploration_in_results": false
 *      }'
 *
 * B) Global commit_floor, pool_4k entitlement_only:
 *    curl -X POST "http://localhost:3000/api/simulations" \
 *      -H "Content-Type: application/json" \
 *      -d '{
 *        "candidate_config_version_id": "cfg_smb_learning_prod_v2_candidate",
 *        "baseline_config_version_id": "cfg_smb_learning_prod_v1",
 *        "historical_window_days": 30,
 *        "filters": {
 *          "workspace_id": "ws_1049",
 *          "segment": "ai_video_smb",
 *          "stage": "learning",
 *          "target_environment": "production"
 *        },
 *        "pricing_mode": "revenue_proxy_commit",
 *        "commit_semantics": "commit_floor",
 *        "pool_pricing_mode_overrides": {
 *          "pool_4k": "revenue_proxy_commit"
 *        },
 *        "pool_commit_semantics_overrides": {
 *          "pool_4k": "entitlement_only"
 *        },
 *        "include_exploration_in_results": false
 *      }'
 *
 * C) Global total, pool_4k commit_floor (should only affect pool_4k if commit mode):
 *    curl -X POST "http://localhost:3000/api/simulations" \
 *      -H "Content-Type: application/json" \
 *      -d '{
 *        "candidate_config_version_id": "cfg_smb_learning_prod_v2_candidate",
 *        "baseline_config_version_id": "cfg_smb_learning_prod_v1",
 *        "historical_window_days": 30,
 *        "filters": {
 *          "workspace_id": "ws_1049",
 *          "segment": "ai_video_smb",
 *          "stage": "learning",
 *          "target_environment": "production"
 *        },
 *        "pricing_mode": "revenue_proxy_total",
 *        "pool_pricing_mode_overrides": {
 *          "pool_4k": "revenue_proxy_commit"
 *        },
 *        "pool_commit_semantics_overrides": {
 *          "pool_4k": "commit_floor"
 *        },
 *        "include_exploration_in_results": false
 *      }'
 */
