import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _: NextRequest,
  ctx: { params: { configId: string } }
) {
  try {
    const configId = ctx.params.configId;
    const config = await prisma.configVersion.findUnique({
      where: { config_version_id: configId },
      select: {
        workspace_id: true,
        segment: true,
        stage: true,
        target_environment: true,
      },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    // Find all configs with the same subject_resolution
    const configs = await prisma.configVersion.findMany({
      where: {
        workspace_id: config.workspace_id,
        segment: config.segment,
        stage: config.stage,
        target_environment: config.target_environment,
        config_version_id: { not: configId }, // Exclude current config
      },
      select: {
        config_version_id: true,
        version: true,
        status: true,
        effective_at: true,
      },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({ items: configs });
  } catch (err: any) {
    console.error("Baseline options error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

