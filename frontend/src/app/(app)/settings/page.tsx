"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_PREFS, useAsync, usePersistentState, usePrefs } from "@/lib/hooks";
import type { Prefs } from "@/lib/hooks";
import { num } from "@/lib/format";
import { RunSelect } from "@/components/RunSelect";
import { Card, EmptyState, ErrorBanner, PageHeader, Spinner } from "@/components/ui";

export default function SettingsPage() {
  const runs = useAsync(() => api.models(), []);
  const [runPref, setRunPref] = usePersistentState<number | null>("fraud_selected_run", null);
  const [prefs, savePrefs] = usePrefs();
  const [draft, setDraft] = useState<Prefs>(DEFAULT_PREFS);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [tMed, setTMed] = useState("0.5");
  const [tHigh, setTHigh] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(prefs); }, [JSON.stringify(prefs)]); // eslint-disable-line react-hooks/exhaustive-deps

  const runList = runs.data ?? [];
  const runId = runPref && runList.some((r) => r.model_run_id === runPref) ? runPref : (runList.find((r) => r.is_best) ?? runList[0])?.model_run_id ?? null;
  const run = runList.find((r) => r.model_run_id === runId);

  useEffect(() => {
    if (run?.risk_policy) { setTMed(String(run.risk_policy.t_medium)); setTHigh(String(run.risk_policy.t_high)); setSaved(false); }
  }, [run?.model_run_id, run?.risk_policy?.t_medium, run?.risk_policy?.t_high]); // eslint-disable-line react-hooks/exhaustive-deps

  const med = Number(tMed), high = Number(tHigh);
  const policyError = Number.isNaN(med) || Number.isNaN(high) ? "Thresholds must be numbers."
    : med < 0 || high > 1 ? "Thresholds must be between 0 and 1."
    : med > high ? "The MEDIUM threshold must not exceed the HIGH threshold." : null;

  async function savePolicy() {
    if (!runId || policyError) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      await api.setPolicy(runId, { t_medium: med, t_high: high });
      await runs.reload();
      setSaved(true);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  const prefsInvalid = draft.testSize + draft.valSize >= 0.9 || draft.pageSize < 5 || draft.pageSize > 200;

  return (
    <>
      <PageHeader title="Settings" description="Risk thresholds, training defaults and preprocessing information." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Risk thresholds" subtitle="LOW / MEDIUM / HIGH are application-level categories derived from a configurable policy, not universal financial standards.">
          <ErrorBanner error={error} />
          {runs.loading && !runs.data && <Spinner />}
          {runs.data && runList.length === 0 && <EmptyState title="No trained models" description="Train a model to configure its risk thresholds." />}
          {run && (
            <div className="space-y-4">
              <RunSelect runs={runList} value={runId} onChange={setRunPref} />
              <p className="text-sm text-slate-600">Validated decision threshold (predicted label): <span className="font-semibold tabular-nums">{num(run.metrics.test.threshold, 4)}</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="tm" className="label">MEDIUM from</label><input id="tm" className="input" inputMode="decimal" value={tMed} onChange={(e) => { setTMed(e.target.value); setSaved(false); }} /></div>
                <div><label htmlFor="th" className="label">HIGH from</label><input id="th" className="input" inputMode="decimal" value={tHigh} onChange={(e) => { setTHigh(e.target.value); setSaved(false); }} /></div>
              </div>
              <p className="text-xs text-slate-500">Probability below MEDIUM → LOW · between → MEDIUM · at or above HIGH → HIGH. Applies to new predictions made with this model run.</p>
              {policyError && <p className="text-sm text-red-600" role="alert">{policyError}</p>}
              {saved && <p className="text-sm text-emerald-700" role="status">Thresholds saved.</p>}
              <button className="btn-primary" disabled={busy || !!policyError} onClick={savePolicy}>{busy ? "Saving…" : "Save thresholds"}</button>
            </div>
          )}
        </Card>

        <Card title="Training defaults" subtitle="Used to pre-fill Model Lab and page sizes. Stored in this browser only.">
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="p-seed" className="label">Random seed</label><input id="p-seed" type="number" className="input" value={draft.seed} onChange={(e) => { setDraft({ ...draft, seed: Number(e.target.value) }); setPrefsSaved(false); }} /></div>
            <div><label htmlFor="p-ps" className="label">Rows per page</label><input id="p-ps" type="number" min={5} max={200} className="input" value={draft.pageSize} onChange={(e) => { setDraft({ ...draft, pageSize: Number(e.target.value) }); setPrefsSaved(false); }} /></div>
            <div><label htmlFor="p-ts" className="label">Test size</label><input id="p-ts" type="number" step="0.05" className="input" value={draft.testSize} onChange={(e) => { setDraft({ ...draft, testSize: Number(e.target.value) }); setPrefsSaved(false); }} /></div>
            <div><label htmlFor="p-vs" className="label">Validation size</label><input id="p-vs" type="number" step="0.05" className="input" value={draft.valSize} onChange={(e) => { setDraft({ ...draft, valSize: Number(e.target.value) }); setPrefsSaved(false); }} /></div>
            <div><label htmlFor="p-st" className="label">Threshold strategy</label>
              <select id="p-st" className="input" value={draft.strategy} onChange={(e) => { setDraft({ ...draft, strategy: e.target.value as Prefs["strategy"] }); setPrefsSaved(false); }}>
                <option value="max_f1">Maximise F1</option><option value="min_precision">Min precision</option>
              </select></div>
            <div><label htmlFor="p-mp" className="label">Minimum precision</label><input id="p-mp" type="number" step="0.05" min="0" max="1" className="input" value={draft.minPrecision} onChange={(e) => { setDraft({ ...draft, minPrecision: Number(e.target.value) }); setPrefsSaved(false); }} /></div>
          </div>
          {prefsInvalid && <p className="mt-2 text-sm text-red-600" role="alert">Test + validation size must be below 0.9, and rows per page must be 5–200.</p>}
          {prefsSaved && <p className="mt-2 text-sm text-emerald-700" role="status">Defaults saved.</p>}
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" disabled={prefsInvalid} onClick={() => { savePrefs(draft); setPrefsSaved(true); }}>Save defaults</button>
            <button className="btn-secondary" onClick={() => { setDraft(DEFAULT_PREFS); savePrefs(DEFAULT_PREFS); setPrefsSaved(true); }}>Reset</button>
          </div>
        </Card>

        <Card title="Preprocessing (fixed by the pipeline)" className="lg:col-span-2">
          <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <li>• Missing values: median imputation, fitted on training data only</li>
            <li>• Scaling: standardization, fitted on training data only</li>
            <li>• Split: stratified train / validation / test with a recorded seed</li>
            <li>• Class imbalance: class weights inside the training data only</li>
            <li>• SVM: trained on a documented stratified sample for speed</li>
            <li>• Anomaly detection: Isolation Forest, trained separately and never merged into the fraud label</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
