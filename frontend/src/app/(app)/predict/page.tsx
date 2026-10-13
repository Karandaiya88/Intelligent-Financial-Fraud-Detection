"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync, usePersistentState } from "@/lib/hooks";
import { ULB_FEATURES } from "@/lib/format";
import type { Prediction } from "@/lib/types";
import { InvestigationPanel } from "@/components/InvestigationPanel";
import { RunSelect } from "@/components/RunSelect";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Card, Disclaimer, EmptyState, ErrorBanner, PageHeader, Spinner } from "@/components/ui";

/** Minimal CSV reader for a header row + first data row (quotes stripped). */
function parseOneRowCsv(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("The file needs a header row and at least one data row.");
  const clean = (s: string) => s.trim().replace(/^"|"$/g, "");
  const head = lines[0].split(",").map(clean);
  const vals = lines[1].split(",").map(clean);
  const out: Record<string, string> = {};
  head.forEach((h, i) => { out[h] = vals[i] ?? ""; });
  return out;
}

export default function PredictPage() {
  const runs = useAsync(() => api.models(), []);
  const [runPref, setRunPref] = usePersistentState<number | null>("fraud_selected_run", null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const runList = runs.data ?? [];
  const runId = runPref && runList.some((r) => r.model_run_id === runPref) ? runPref : (runList.find((r) => r.is_best) ?? runList[0])?.model_run_id ?? null;

  async function loadFile(file: File) {
    setError(null); setNote(null);
    try {
      if (file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Please upload a one-row CSV here (Excel files can be scored in bulk on the Transactions page).");
      const row = parseOneRowCsv(await file.text());
      const next: Record<string, string> = {};
      let filled = 0;
      ULB_FEATURES.forEach((f) => { if (row[f] !== undefined && row[f] !== "") { next[f] = row[f]; filled++; } });
      setValues(next);
      setNote(`Filled ${filled} of ${ULB_FEATURES.length} fields from the first data row.`);
    } catch (e) {
      setError(e as Error);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!runId) return;
    setError(null); setResult(null);
    const features: Record<string, number | null> = {};
    for (const f of ULB_FEATURES) {
      const raw = (values[f] ?? "").trim();
      if (raw === "") { features[f] = null; continue; }
      const n = Number(raw);
      if (Number.isNaN(n)) { setError(new Error(`Feature "${f}" must be a number.`)); return; }
      features[f] = n;
    }
    setBusy(true);
    try {
      setResult(await api.predict(runId, features, reference.trim() || undefined));
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  const filled = ULB_FEATURES.filter((f) => (values[f] ?? "").trim() !== "").length;

  return (
    <>
      <PageHeader title="Single Prediction" description="Enter feature values for one transaction, or fill them from a one-row CSV. The same preprocessing pipeline used in training is applied." />
      <ErrorBanner error={runs.error} />
      {runs.loading && !runs.data && <Spinner />}
      {runs.data && runList.length === 0 && <EmptyState title="Train a model first" description="Predictions need a trained model run. Open Model Lab to train one." />}

      {runList.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
          <form onSubmit={submit} className="space-y-6">
            <Card title="Input">
              <div className="grid gap-4 sm:grid-cols-2">
                <RunSelect runs={runList} value={runId} onChange={setRunPref} />
                <div><label htmlFor="ref" className="label">Transaction reference (optional)</label><input id="ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. txn-1042" /></div>
              </div>
              <div className="mt-4">
                <UploadDropzone accept={[".csv"]} onFile={loadFile} title="Fill from a one-row CSV" hint="Header row + one data row. Matching columns are copied into the form." />
                {note && <p className="mt-2 text-sm text-emerald-700">{note}</p>}
              </div>
            </Card>

            <Card title="Feature values" subtitle={`${filled} of ${ULB_FEATURES.length} fields filled. Empty fields are replaced by the training median.`}
              actions={<button type="button" className="btn-secondary" onClick={() => { setValues({}); setNote(null); setResult(null); }}>Clear</button>}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {ULB_FEATURES.map((f) => (
                  <div key={f}>
                    <label htmlFor={`f-${f}`} className="label">{f}</label>
                    <input id={`f-${f}`} className="input" inputMode="decimal" value={values[f] ?? ""} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">V1–V28 are anonymized transformed features, so no merchant, device or location details are available.</p>
              <div className="mt-4"><button className="btn-primary" type="submit" disabled={busy || !runId}>{busy ? <Spinner label="Scoring…" /> : "Predict"}</button></div>
            </Card>
          </form>

          <div className="space-y-4">
            <ErrorBanner error={error} />
            <Card title="Result">
              {result ? <InvestigationPanel pred={result} /> : <p className="py-8 text-center text-sm text-slate-500">Submit a transaction to see its fraud probability, risk band, anomaly signal and feature signals.</p>}
            </Card>
            <Disclaimer />
          </div>
        </div>
      )}
    </>
  );
}
