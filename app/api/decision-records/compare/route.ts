// app/api/decision-records/compare/route.ts
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

async function loadDecision(decision_id: string) {
  const d = await prisma.decisionRecord.findUnique({ where: { decision_id } });
  if (!d) return null;

  const cfg = await prisma.configVersion.findUnique({ where: { config_version_id: d.config_version_id } });
  const sim = d.simulation_run_id
    ? await prisma.simulationRun.findUnique({ where: { simulation_run_id: d.simulation_run_id } })
    : null;

  return {
    decision: { ...d, subject_resolution: safeJsonParse(d.subject_resolution, null), diff: safeJsonParse(d.diff, null) },
    config: cfg
      ? { ...cfg, pools: safeJsonParse(cfg.pools, []), exploration: safeJsonParse(cfg.exploration, {}), rails: safeJsonParse(cfg.rails, {}) }
      : null,
    simulation: sim ? { ...sim, input: safeJsonParse(sim.input, {}), output: safeJsonParse(sim.output, {}) } : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const a = sp.get("decision_id_a");
    const b = sp.get("decision_id_b");

    if (!a || !b) {
      return NextResponse.json(
        { error: "Missing required query params: decision_id_a, decision_id_b" },
        { status: 400 }
      );
    }

    const [A, B] = await Promise.all([loadDecision(a), loadDecision(b)]);
    if (!A || !B) {
      return NextResponse.json({ error: "One or both DecisionRecords not found" }, { status: 404 });
    }

    return NextResponse.json({ a: A, b: B });
  } catch (err: any) {
    console.error("DecisionRecords compare error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
