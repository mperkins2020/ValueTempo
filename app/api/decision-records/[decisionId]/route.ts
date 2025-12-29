// app/api/decision-records/[decisionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function safeJsonParse<T>(value: any, fallback: T): T {
  try {
    if (value == null) return fallback;
    if (typeof value === "string") return JSON.parse(value) as T;
    return value as T;
  } catch {
    return fallback;
  }
}

export async function GET(_: NextRequest, ctx: { params: { decisionId: string } }) {
  try {
    const decisionId = ctx.params.decisionId;

    const decision = await prisma.decisionRecord.findUnique({
      where: { decision_id: decisionId },
    });

    if (!decision) {
      return NextResponse.json({ error: "DecisionRecord not found" }, { status: 404 });
    }

    const config = await prisma.configVersion.findUnique({
      where: { config_version_id: decision.config_version_id },
    });

    const simulation = decision.simulation_run_id
      ? await prisma.simulationRun.findUnique({ where: { simulation_run_id: decision.simulation_run_id } })
      : null;

    const billingPatch = decision.billing_patch_id
      ? await prisma.billingPatch.findUnique({ where: { billing_patch_id: decision.billing_patch_id } })
      : null;

    return NextResponse.json({
      decision: {
        ...decision,
        subject_resolution: safeJsonParse(decision.subject_resolution, null),
        diff: safeJsonParse(decision.diff, null),
      },
      config: config
        ? {
            ...config,
            pools: safeJsonParse(config.pools, []),
            exploration: safeJsonParse(config.exploration, {}),
            rails: safeJsonParse(config.rails, {}),
          }
        : null,
      simulation: simulation
        ? {
            ...simulation,
            input: safeJsonParse(simulation.input, {}),
            output: safeJsonParse(simulation.output, {}),
          }
        : null,
      billing_patch: billingPatch
        ? {
            ...billingPatch,
            payload: safeJsonParse(billingPatch.payload, {}),
          }
        : null,
    });
  } catch (err: any) {
    console.error("DecisionRecords detail error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
