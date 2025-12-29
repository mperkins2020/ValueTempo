// app/api/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

function nowIso() {
  return new Date().toISOString();
}
function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return fallback;
    try {
      return JSON.parse(s) as T;
    } catch {
      return fallback;
    }
  }

  // already an object/array
  return value as T;
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const config_version_id = body.config_version_id as string | undefined;
    const simulation_run_id = body.simulation_run_id as string | undefined;

    const approver_name = body.approver_name as string | undefined;
    const approver_role = body.approver_role as string | undefined;
    const rationale = body.rationale as string | undefined;
    const effective_at = body.effective_at ? new Date(body.effective_at) : new Date();

    if (
      !config_version_id ||
      !simulation_run_id ||
      !approver_name ||
      !approver_role ||
      !rationale
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: config_version_id, simulation_run_id, approver_name, approver_role, rationale",
        },
        { status: 400 }
      );
    }

    const candidate = await prisma.configVersion.findUnique({
      where: { config_version_id },
      include: { cycle: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const sim = await prisma.simulationRun.findUnique({
      where: { simulation_run_id },
    });
    if (!sim) {
      return NextResponse.json(
        { error: "SimulationRun not found" },
        { status: 404 }
      );
    }
    if (sim.config_version_id !== candidate.config_version_id) {
      return NextResponse.json(
        { error: "SimulationRun does not belong to this config_version_id" },
        { status: 400 }
      );
    }

    // Find baseline = current active config for this subject_resolution (if any)
    // Safety: exclude candidate id in case candidate is already active.
    const baseline = await prisma.configVersion.findFirst({
      where: {
        workspace_id: candidate.workspace_id,
        segment: candidate.segment,
        stage: candidate.stage,
        target_environment: candidate.target_environment,
        status: "active",
        NOT: { config_version_id: candidate.config_version_id },
      },
      orderBy: { created_at: "desc" },
    });

    // Enforce deterministic gating for production, match your Build Pack Prompt
    if (candidate.target_environment === "production") {
      if (
        candidate.cycle.cycle_type !== "production" ||
        candidate.cycle.period_length_days !== 90
      ) {
        return NextResponse.json(
          {
            error:
              "Production activation requires cycle_type=production and period_length_days=90",
          },
          { status: 400 }
        );
      }

      const rails = safeJsonParse<Record<string, unknown>>(candidate.rails, {});
      const usage_thresholds = rails?.usage_thresholds ?? [];

      const thresholds = Array.isArray((rails as any)?.usage_thresholds) ? (rails as any).usage_thresholds : [];
      const has7090100 =
        thresholds.some((x: any) => x.percent === 70) &&
        thresholds.some((x: any) => x.percent === 90) &&
        thresholds.some((x: any) => x.percent === 100);

      if (!rails || typeof rails !== "object") {
        return NextResponse.json(
          { error: "Rails incomplete for production activation: rails object missing or invalid" },
          { status: 400 }
        );
      }

      const monthlySpendCap = (rails as any).monthly_spend_cap_usd;
      if (typeof monthlySpendCap !== "number" || !Number.isFinite(monthlySpendCap) || monthlySpendCap < 0) {
        return NextResponse.json(
          { error: "Rails incomplete for production activation: monthly_spend_cap_usd must be a number >= 0" },
          { status: 400 }
        );
      }

      const marginFloor = (rails as any).margin_floor;
      if (typeof marginFloor !== "number" || !Number.isFinite(marginFloor) || marginFloor < 0 || marginFloor > 1) {
        return NextResponse.json(
          { error: "Rails incomplete for production activation: margin_floor must be a number between 0 and 1 inclusive" },
          { status: 400 }
        );
      }

      if (!has7090100) {
        return NextResponse.json(
          { error: "Rails incomplete for production activation" },
          { status: 400 }
        );
      }
    }

    // Diff, MVP: store before/after snapshots of core JSON fields
    const diff = {
      baseline_config_version_id: baseline?.config_version_id ?? null,
      candidate_config_version_id: candidate.config_version_id,
      before: baseline
        ? {
            pools: safeJsonParse<unknown>(baseline.pools, []),
            exploration: safeJsonParse<unknown>(baseline.exploration, {}),
            rails: safeJsonParse<unknown>(baseline.rails, {}),
          }
        : null,
      after: {
        pools: safeJsonParse<unknown>(candidate.pools, []),
        exploration: safeJsonParse<unknown>(candidate.exploration, {}),
        rails: safeJsonParse<unknown>(candidate.rails, {}),
      },
    };    

    // Pre-generate IDs required by schema
    const billing_patch_id = `bp_${randomUUID()}`;
    const decision_id = `dec_${randomUUID()}`;

    // Transaction: archive prior active, activate candidate, write decision + billing patch
    const result = await prisma.$transaction(async (tx) => {
      if (baseline) {
        await tx.configVersion.update({
          where: { config_version_id: baseline.config_version_id },
          data: { status: "archived" },
        });
      }

      const billingPatch = await tx.billingPatch.create({
        data: {
          billing_patch_id, // ✅ required PK
          config_version_id: candidate.config_version_id,
          workspace_id: candidate.workspace_id,
          cycle_id: candidate.cycle_id,
          price_book_ref: candidate.price_book_ref,
          effective_at,
          payload: JSON.stringify({
            billing_patch_id, // ✅ keep payload aligned to record id
            generated_at: nowIso(),
            config_version_id: candidate.config_version_id,
            price_book_ref: candidate.price_book_ref,
            note: "MVP patch, do not call Metronome APIs",
          }),
        },
      });

      await tx.configVersion.update({
        where: { config_version_id: candidate.config_version_id },
        data: {
          status: "active",
          billing_patch_id: billingPatch.billing_patch_id,
          effective_at,
        },
      });

      const decisionRecord = await tx.decisionRecord.create({
        data: {
          decision_id, // ✅ required PK
          config_version_id: candidate.config_version_id,
          cycle_id: candidate.cycle_id,
          baseline_config_version_id: baseline?.config_version_id ?? null,
          billing_patch_id: billingPatch.billing_patch_id,
          subject_resolution: JSON.stringify({
            workspace_id: candidate.workspace_id,
            segment: candidate.segment,
            stage: candidate.stage,
            target_environment: candidate.target_environment,
          }),
          value_unit_snapshot_version: candidate.value_unit_snapshot_version,
          approver_name,
          approver_role,
          rationale,
          diff: JSON.stringify(diff),
          simulation_run_id,
          effective_at,
        },
      });

      return { decisionRecord, billingPatch };
    });

    return NextResponse.json({
      decision_id: result.decisionRecord.decision_id,
      config_version_id: candidate.config_version_id,
      billing_patch_id: result.billingPatch.billing_patch_id,
      status: "active",
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "Internal server error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
