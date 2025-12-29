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

export async function GET(
  _: NextRequest,
  ctx: { params: { configId: string } }
) {
  try {
    const configId = ctx.params.configId;
    const config = await prisma.configVersion.findUnique({
      where: { config_version_id: configId },
      include: {
        cycle: {
          select: {
            goal_type: true,
            primary_metrics: true,
            narrative: true,
          },
        },
      },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({
      config_version_id: config.config_version_id,
      workspace_id: config.workspace_id,
      segment: config.segment,
      stage: config.stage,
      target_environment: config.target_environment,
      status: config.status,
      version: config.version,
      effective_at: config.effective_at,
      value_unit_snapshot_version: config.value_unit_snapshot_version,
      price_book_ref: config.price_book_ref,
      pools: safeJsonParse(config.pools, []),
      exploration: safeJsonParse(config.exploration, {}),
      rails: safeJsonParse(config.rails, {}),
      cycle: {
        goal_type: config.cycle.goal_type,
        primary_metrics: safeJsonParse(config.cycle.primary_metrics, []),
        narrative: config.cycle.narrative,
      },
    });
  } catch (err: any) {
    console.error("Config detail error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

