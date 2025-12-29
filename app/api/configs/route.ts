import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const configs = await prisma.configVersion.findMany({
      orderBy: { updated_at: "desc" },
      select: {
        config_version_id: true,
        workspace_id: true,
        segment: true,
        stage: true,
        target_environment: true,
        status: true,
        version: true,
        effective_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({ items: configs });
  } catch (err: any) {
    console.error("Configs list error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

