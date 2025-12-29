// app/decision-log/[decisionId]/decision-log-detail-client.tsx
"use client";

import * as React from "react";
import Link from "next/link";

type SubjectResolution = {
  workspace_id: string;
  segment: string;
  stage: string;
  target_environment: string;
};

type DecisionRecord = {
  decision_id: string;
  config_version_id: string;
  cycle_id: string;
  baseline_config_version_id: string | null;
  billing_patch_id: string;
  subject_resolution: SubjectResolution;
  value_unit_snapshot_version: number;
  approver_name: string;
  approver_role: string;
  rationale: string;
  diff: unknown;
  simulation_run_id: string;
  effective_at: string;
  created_at: string;
};

type ConfigVersion = {
  config_version_id: string;
  cycle_id: string;
  workspace_id: string;
  segment: string;
  stage: string;
  target_environment: string;
  version: number;
  status: string;
  effective_at: string;
  pools: unknown;
  exploration: unknown;
  rails: unknown;
  billing_patch_id: string | null;
  value_unit_snapshot_version: number;
  price_book_ref: string;
  created_at: string;
  updated_at: string;
};

type SimulationRun = {
  simulation_run_id: string;
  config_version_id: string;
  baseline_config_version_id: string | null;
  input: unknown;
  output: unknown;
  completeness_result: "green" | "amber" | "red";
  created_at: string;
};

type BillingPatch = {
  billing_patch_id: string;
  config_version_id: string;
  workspace_id: string;
  cycle_id: string;
  price_book_ref: string;
  effective_at: string;
  payload: unknown;
  created_at: string;
};

type ApiResponse = {
  decision: DecisionRecord;
  config: ConfigVersion;
  simulation: SimulationRun | null;
  billing_patch: BillingPatch | null;
};

function formatIso(iso: string | null | undefined) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : tone === "amber"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : tone === "red"
      ? "bg-red-100 text-red-900 border-red-200"
      : tone === "blue"
      ? "bg-blue-100 text-blue-900 border-blue-200"
      : "bg-slate-100 text-slate-900 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {label}
    </span>
  );
}

function SectionCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="text-sm font-semibold">{title}</div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function KV({
  k,
  v,
}: {
  k: string;
  v: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="text-xs text-slate-500">{k}</div>
      <div className="text-sm text-slate-900 sm:text-right">{v}</div>
    </div>
  );
}

function JsonBlock({
  value,
  label = "JSON",
}: {
  value: unknown;
  label?: string;
}) {
  const json = React.useMemo(() => {
    try {
      return JSON.stringify(value ?? null, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }

  return (
    <div className="mt-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-600">{label}</div>
        <button
          onClick={copy}
          className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
          type="button"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto rounded-md border bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
        {json}
      </pre>
    </div>
  );
}

export default function DecisionLogDetailClient({ decisionId }: { decisionId: string }) {
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/decision-records/${encodeURIComponent(decisionId)}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`HTTP ${res.status}: ${t}`);
        }

        const json = (await res.json()) as ApiResponse;
        if (!alive) return;

        setData(json);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load decision record");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [decisionId]);

  const completenessTone =
    data?.simulation?.completeness_result === "red"
      ? "red"
      : data?.simulation?.completeness_result === "amber"
      ? "amber"
      : data?.simulation?.completeness_result === "green"
      ? "green"
      : "gray";

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Decision Detail</h1>
          {data?.config?.status ? (
            <Pill label={String(data.config.status)} tone={data.config.status === "active" ? "green" : "gray"} />
          ) : null}
          {data?.simulation?.completeness_result ? (
            <Pill label={`Simulation: ${data.simulation.completeness_result}`} tone={completenessTone as any} />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
            href="/decision-log"
          >
            Back to Decision Log
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-600">Loading…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : !data ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-600">No data.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard
            title="Decision"
            right={<Pill label={data.decision.decision_id} tone="blue" />}
          >
            <div className="divide-y">
              <KV k="Created" v={formatIso(data.decision.created_at)} />
              <KV k="Effective at" v={formatIso(data.decision.effective_at)} />
              <KV k="Approver" v={`${data.decision.approver_name}, ${data.decision.approver_role}`} />
              <KV k="Config version" v={data.decision.config_version_id} />
              <KV k="Baseline config" v={data.decision.baseline_config_version_id ?? "none"} />
              <KV k="Simulation run" v={data.decision.simulation_run_id} />
              <KV k="Billing patch" v={data.decision.billing_patch_id} />
              <KV k="Value unit snapshot version" v={data.decision.value_unit_snapshot_version} />
            </div>

            <div className="mt-3 text-sm">
              <div className="text-xs font-medium text-slate-600">Rationale</div>
              <div className="mt-1 rounded-md border bg-slate-50 p-3 text-sm text-slate-900">
                {data.decision.rationale}
              </div>
            </div>

            <JsonBlock value={data.decision.diff} label="diff" />
          </SectionCard>

          <SectionCard title="Subject Resolution">
            <div className="divide-y">
              <KV k="workspace_id" v={data.decision.subject_resolution.workspace_id} />
              <KV k="segment" v={data.decision.subject_resolution.segment} />
              <KV k="stage" v={data.decision.subject_resolution.stage} />
              <KV k="target_environment" v={data.decision.subject_resolution.target_environment} />
            </div>
          </SectionCard>

          <SectionCard title="Config Version">
            <div className="divide-y">
              <KV k="config_version_id" v={data.config.config_version_id} />
              <KV k="version" v={data.config.version} />
              <KV k="status" v={data.config.status} />
              <KV k="effective_at" v={formatIso(data.config.effective_at)} />
              <KV k="price_book_ref" v={data.config.price_book_ref} />
              <KV k="billing_patch_id" v={data.config.billing_patch_id ?? "none"} />
            </div>

            <JsonBlock value={data.config.pools} label="pools" />
            <JsonBlock value={data.config.exploration} label="exploration" />
            <JsonBlock value={data.config.rails} label="rails" />
          </SectionCard>

          <SectionCard title="Simulation">
            {data.simulation ? (
              <>
                <div className="divide-y">
                  <KV k="simulation_run_id" v={data.simulation.simulation_run_id} />
                  <KV k="created_at" v={formatIso(data.simulation.created_at)} />
                  <KV k="baseline_config_version_id" v={data.simulation.baseline_config_version_id ?? "none"} />
                  <KV k="completeness_result" v={data.simulation.completeness_result} />
                </div>

                <JsonBlock value={data.simulation.input} label="input" />
                <JsonBlock value={data.simulation.output} label="output" />
              </>
            ) : (
              <div className="text-sm text-slate-600">No simulation attached to this decision.</div>
            )}
          </SectionCard>

          <div className="lg:col-span-2">
            <SectionCard title="Billing Patch">
              {data.billing_patch ? (
                <>
                  <div className="divide-y">
                    <KV k="billing_patch_id" v={data.billing_patch.billing_patch_id} />
                    <KV k="effective_at" v={formatIso(data.billing_patch.effective_at)} />
                    <KV k="price_book_ref" v={data.billing_patch.price_book_ref} />
                    <KV k="created_at" v={formatIso(data.billing_patch.created_at)} />
                  </div>
                  <JsonBlock value={data.billing_patch.payload} label="payload" />
                </>
              ) : (
                <div className="text-sm text-slate-600">No billing patch found for this decision.</div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
