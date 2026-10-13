"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAsync, usePersistentState, usePrefs } from "@/lib/hooks";
import { int, num, pct } from "@/lib/format";
import type { BulkResult, Prediction } from "@/lib/types";
import { InvestigationPanel } from "@/components/InvestigationPanel";
import { RunSelect } from "@/components/RunSelect";
import { UploadDropzone } from "@/components/UploadDropzone";
import { AnomalyBadge, Card, Disclaimer, EmptyState, ErrorBanner, MetricCard, PageHeader, RiskBadge, Spinner } from "@/components/ui";

interface Filters { risk: string; anomaly: string; minProb: string; q: string }
const NO_FILTERS: Filters = { risk: "", anomaly: "", minProb: "", q: "" };

export default function TransactionsPage() {
  const runs = useAsync(() => api.models(), []);
  const [prefs] = usePrefs();
  const [runPref, setRunPref] = usePersistentState<number | null>("fraud_selected_run", null);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<Error | null>(null);
  const [bulk, setBulk] = useState<BulkResult | null>(null);

  const runList = runs.data ?? [];
  const runId = runPref && runList.some((r) => r.model_run_id === runPref) ? runPref : (runList.find((r) => r.is_best) ?? runList[0])?.model_run_id ?? null;

  const page = useAsync(
    () => runId
      ? api.predictions({
          model_run_id: runId, limit: prefs.pageSize, offset,
          risk_level: applied.risk || undefined,
          is_anomaly: applied.anomaly === "" ? undefined : applied.anomaly === "yes",
          min_probability: applied.minProb === "" ? undefined : Number(applied.minProb),
          q: applied.q || undefined,
        })
      : Promise.resolve(null),
    [runId, applied, offset, prefs.pageSize],
  );
  const detail = useAsync(() => (openId ? api.prediction(openId) : Promise.resolve(null)), [openId]);

  useEffect(() => { setOffset(0); setOpenId(null); }, [runId, applied]);

  async function uploadBulk(file: File) {
    if (!runId) return;
    setBulkBusy(true); setBulkError(null);
    try {
      setBulk(await api.bulkPredict(runId, file));
      setOffset(0);
      await page.reload();
    } catch (e) {
      setBulkError(e as Error);
    } finally {
      setBulkBusy(false);
    }
  }

  const items: Prediction[] = page.data?.items ?? [];
  const total = page.data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + prefs.pageSize, total);
  const probInvalid = draft.minProb !== "" && (Number(draft.minProb) < 0 || Number(draft.minProb) > 1 || Number.isNaN(Number(draft.minProb)));

  return (
    <>
      <PageHeader title="Transaction Analysis" description="Score batches of transactions, then search, filter and investigate individual results. Fraud risk and anomaly signals are shown separately." />

      <ErrorBanner error={runs.error} />
      {runs.data && runList.length === 0 && <EmptyState title="Train a model first" description="Scoring needs a trained model run. Open Model Lab to train one." />}

      {runList.length > 0 && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <Card title="Model">
              <RunSelect runs={runList} value={runId} onChange={setRunPref} />
            </Card>
            <Card title="Score a batch" subtitle="Upload a CSV/Excel file with the same feature columns used in training (a target column is ignored).">
              <ErrorBanner error={bulkError} />
              <UploadDropzone onFile={uploadBulk} busy={bulkBusy} disabled={!runId} title="Drop a batch file to score" />
            </Card>
          </div>

          {bulk && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <MetricCard label="Scored" value={int(bulk.total)} />
              <MetricCard label="High" value={int(bulk.risk_distribution.HIGH)} tone="danger" />
              <MetricCard label="Medium" value={int(bulk.risk_distribution.MEDIUM)} tone="warning" />
              <MetricCard label="Low" value={int(bulk.risk_distribution.LOW)} tone="good" />
              <MetricCard label="Unusual patterns" value={int(bulk.anomalies)} />
            </div>
          )}

          <Card title="Scored transactions" subtitle="Sorted by fraud probability (highest first). Click a row to investigate.">
            <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); if (!probInvalid) setApplied(draft); }}>
              <div><label htmlFor="f-risk" className="label">Risk</label>
                <select id="f-risk" className="input" value={draft.risk} onChange={(e) => setDraft({ ...draft, risk: e.target.value })}>
                  <option value="">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select></div>
              <div><label htmlFor="f-an" className="label">Anomaly signal</label>
                <select id="f-an" className="input" value={draft.anomaly} onChange={(e) => setDraft({ ...draft, anomaly: e.target.value })}>
                  <option value="">All</option><option value="yes">Unusual</option><option value="no">Typical</option>
                </select></div>
              <div><label htmlFor="f-p" className="label">Min probability (0–1)</label>
                <input id="f-p" className="input" inputMode="decimal" placeholder="e.g. 0.5" value={draft.minProb} onChange={(e) => setDraft({ ...draft, minProb: e.target.value })} aria-invalid={probInvalid} /></div>
              <div><label htmlFor="f-q" className="label">Reference contains</label>
                <input id="f-q" className="input" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} /></div>
              <div className="flex items-end gap-2">
                <button className="btn-primary" type="submit" disabled={probInvalid}>Apply</button>
                <button className="btn-secondary" type="button" onClick={() => { setDraft(NO_FILTERS); setApplied(NO_FILTERS); }}>Reset</button>
              </div>
            </form>
            {probInvalid && <p className="mb-2 text-sm text-red-600" role="alert">Minimum probability must be a number between 0 and 1.</p>}
            <ErrorBanner error={page.error} />

            <div className={`grid gap-6 ${openId ? "xl:grid-cols-[3fr_2fr]" : ""}`}>
              <div>
                {page.loading && !page.data && <Spinner />}
                {page.data && items.length === 0 && <EmptyState title="No transactions match" description="Score a batch above, or adjust the filters." />}
                {items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b border-slate-200"><th className="th">Reference</th><th className="th">Probability</th><th className="th">Label</th><th className="th">Anomaly</th><th className="th">Risk</th></tr></thead>
                      <tbody>
                        {items.map((p) => (
                          <tr key={p.id} tabIndex={0} onClick={() => setOpenId(p.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpenId(p.id); }}
                            className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${openId === p.id ? "bg-brand-50" : ""}`}>
                            <td className="td font-medium">{p.transaction_reference}</td>
                            <td className="td tabular-nums">{pct(p.fraud_probability, 2)}</td>
                            <td className="td">{p.predicted_label === 1 ? "fraud" : "non-fraud"}</td>
                            <td className="td"><span className="mr-2 tabular-nums">{num(p.anomaly_score, 3)}</span><AnomalyBadge isAnomaly={p.is_anomaly} /></td>
                            <td className="td"><RiskBadge level={p.risk_level} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {total > 0 && (
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                    <span>{int(from)}–{int(to)} of {int(total)}</span>
                    <div className="flex gap-2">
                      <button className="btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - prefs.pageSize))}>Previous</button>
                      <button className="btn-secondary" disabled={offset + prefs.pageSize >= total} onClick={() => setOffset(offset + prefs.pageSize)}>Next</button>
                    </div>
                  </div>
                )}
              </div>

              {openId && (
                <aside aria-label="Investigation" className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <ErrorBanner error={detail.error} />
                  {detail.loading && !detail.data && <Spinner />}
                  {detail.data && <InvestigationPanel pred={detail.data} onClose={() => setOpenId(null)} />}
                </aside>
              )}
            </div>
          </Card>
          <Disclaimer />
        </div>
      )}
    </>
  );
}
