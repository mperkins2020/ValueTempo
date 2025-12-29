// app/decision-log/decision-log-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SubjectResolution = {
  workspace_id: string;
  segment: string;
  stage: "learning" | "scaling";
  target_environment: "sandbox" | "production";
};

type DecisionListItem = {
  decision_id: string;
  created_at: string;
  effective_at: string;
  approver_name: string;
  approver_role: string;
  rationale: string;
  config_version_id: string;
  baseline_config_version_id: string | null;
  billing_patch_id: string;
  simulation_run_id: string;
  subject_resolution: SubjectResolution;
  config_status: "draft" | "simulated" | "active" | "archived";
  config_version_number: number;
};

type DecisionListResponse = {
  items: DecisionListItem[];
  total: number;
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function DecisionLogClient() {
  const [data, setData] = useState<DecisionListResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch("/api/decision-records", { cache: "no-store" });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `Request failed: ${res.status}`);
        }
        const json = (await res.json()) as DecisionListResponse;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // If you have multiple DecisionRecords pointing at the same config_version_id,
  // mark only the newest as “Latest” in the UI, even if config_status shows "active".
  const latestDecisionIdByConfig = useMemo(() => {
    const map = new Map<string, { decision_id: string; created_at: string }>();
    for (const item of data?.items ?? []) {
      const cur = map.get(item.config_version_id);
      if (!cur || new Date(item.created_at) > new Date(cur.created_at)) {
        map.set(item.config_version_id, {
          decision_id: item.decision_id,
          created_at: item.created_at,
        });
      }
    }
    return map;
  }, [data]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Decision Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Approvals, diffs, simulations, and billing patch exports.
        </p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}

      {err && (
        <div className="text-sm text-red-600">
          Error loading decisions: {err}
        </div>
      )}

      {!loading && !err && data && (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-2 text-sm text-muted-foreground border-b">
            Total: {data.total}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Approver</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Effective</th>
                </tr>
              </thead>
              <tbody>
                {data.items
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )
                  .map((d) => {
                    const latest = latestDecisionIdByConfig.get(
                      d.config_version_id
                    )?.decision_id;
                    const isLatest = latest === d.decision_id;

                    const s = d.subject_resolution;
                    const subjectLabel = `${s.segment} · ${s.stage} · ${s.target_environment}`;

                    return (
                      <tr key={d.decision_id} className="border-t">
                        <td className="px-4 py-3">
                          <Link
                            className="underline underline-offset-2"
                            href={`/decision-log/${d.decision_id}`}
                          >
                            {d.decision_id}
                          </Link>
                          <div className="text-xs text-muted-foreground mt-1">
                            {d.config_version_id}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium">{subjectLabel}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            ws: {s.workspace_id}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-2">
                            <span className="rounded-md border px-2 py-0.5">
                              {d.config_status}
                            </span>
                            {isLatest ? (
                              <span className="rounded-md border px-2 py-0.5">
                                latest
                              </span>
                            ) : (
                              <span className="rounded-md border px-2 py-0.5 text-muted-foreground">
                                superseded
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div>{d.approver_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {d.approver_role}
                          </div>
                        </td>

                        <td className="px-4 py-3">{fmt(d.created_at)}</td>
                        <td className="px-4 py-3">{fmt(d.effective_at)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
