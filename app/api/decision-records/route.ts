// app/api/decision-records/route.ts
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

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const q = (sp.get("q") ?? "").trim();
    const workspace_id = sp.get("workspace_id") ?? undefined;
    const segment = sp.get("segment") ?? undefined;
    const stage = sp.get("stage") ?? undefined;
    const target_environment = sp.get("target_environment") ?? undefined;

    const limitRaw = Number(sp.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    // If any subject filters exist, filter decisions via ConfigVersion subject fields.
    // This avoids trying to query inside DecisionRecord.subject_resolution JSON.
    let allowedConfigIds: string[] | null = null;

    if (workspace_id || segment || stage || target_environment) {
      const cfgs = await prisma.configVersion.findMany({
        where: {
          ...(workspace_id ? { workspace_id } : {}),
          ...(segment ? { segment } : {}),
          ...(stage ? { stage: stage as any } : {}),
          ...(target_environment ? { target_environment: target_environment as any } : {}),
        },
        select: { config_version_id: true },
      });

      allowedConfigIds = cfgs.map(c => c.config_version_id);

      // No configs match the filter, return empty list quickly.
      if (allowedConfigIds.length === 0) {
        return NextResponse.json({ items: [], total: 0 });
      }
    }

    const where: any = {};

    if (allowedConfigIds) {
      where.config_version_id = { in: allowedConfigIds };
    }

    if (q) {
      where.OR = [
        { decision_id: { contains: q } },
        { config_version_id: { contains: q } },
        { baseline_config_version_id: { contains: q } },
        { approver_name: { contains: q } },
        { approver_role: { contains: q } },
        { rationale: { contains: q } },
      ];
    }

    const decisions = await prisma.decisionRecord.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
    });

    // Batch fetch related ConfigVersions for badges and subject fields
    const configIds = Array.from(new Set(decisions.map(d => d.config_version_id)));
    const configs = await prisma.configVersion.findMany({
      where: { config_version_id: { in: configIds } },
      select: {
        config_version_id: true,
        workspace_id: true,
        segment: true,
        stage: true,
        target_environment: true,
        status: true,
        version: true,
      },
    });
    const configById = new Map(configs.map(c => [c.config_version_id, c]));

    const items = decisions.map(d => {
      const cfg = configById.get(d.config_version_id);

      return {
        decision_id: d.decision_id,
        created_at: d.created_at,
        effective_at: d.effective_at,
        approver_name: d.approver_name,
        approver_role: d.approver_role,
        rationale: d.rationale,
        config_version_id: d.config_version_id,
        baseline_config_version_id: d.baseline_config_version_id,
        billing_patch_id: d.billing_patch_id,
        simulation_run_id: d.simulation_run_id,
        subject_resolution: safeJsonParse(d.subject_resolution, null as any) ?? (cfg ? {
          workspace_id: cfg.workspace_id,
          segment: cfg.segment,
          stage: cfg.stage,
          target_environment: cfg.target_environment,
        } : null),
        config_status: cfg?.status ?? null,
        config_version_number: cfg?.version ?? null,
      };
    });

    return NextResponse.json({ items, total: items.length });
  } catch (err: any) {
    console.error("DecisionRecords list error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
