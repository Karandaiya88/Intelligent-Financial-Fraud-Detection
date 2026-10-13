"use client";
import type { Prediction } from "@/lib/types";
import { num, pct } from "@/lib/format";
import { SignalChart } from "./charts";
import { AnomalyBadge, Disclaimer, RiskBadge } from "./ui";

export function InvestigationPanel({ pred, onClose }: { pred: Prediction; onClose?: () => void }) {
  const features = Object.entries(pred.features ?? {});
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction</p>
          <h3 className="text-lg font-bold text-slate-900">{pred.transaction_reference}</h3>
        </div>
        {onClose && <button className="btn-secondary !px-2 !py-1" onClick={onClose} aria-label="Close investigation panel">✕</button>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Fraud probability (model estimate)</p>
          <p className="text-2xl font-bold text-slate-900">{pct(pred.fraud_probability, 2)}</p>
          <div className="mt-2"><RiskBadge level={pred.risk_level} /></div>
          <p className="mt-2 text-xs text-slate-500">Predicted label: {pred.predicted_label === 1 ? "fraud" : "non-fraud"}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Anomaly signal (separate from fraud risk)</p>
          <p className="text-2xl font-bold text-slate-900">{num(pred.anomaly_score, 3)}</p>
          <div className="mt-2"><AnomalyBadge isAnomaly={pred.is_anomaly} /></div>
          <p className="mt-2 text-xs text-slate-500">Unusual does not mean fraudulent.</p>
        </div>
      </div>

      {pred.explanation && (
        <div>
          <h4 className="mb-1 text-sm font-semibold text-slate-800">Top feature signals</h4>
          <p className="mb-2 text-xs text-slate-500">
            Method: {pred.explanation.method === "linear_contribution" ? "linear contribution (coefficient × standardized value)" : "standardized deviation from the training mean"}.
            Red pushes toward fraud / above average; teal is the opposite. {pred.explanation.note}
          </p>
          <SignalChart signals={pred.explanation.top_features} />
        </div>
      )}

      {features.length > 0 && (
        <details className="rounded-lg border border-slate-200">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">All input features ({features.length})</summary>
          <div className="max-h-64 overflow-auto">
            <table className="w-full">
              <tbody>
                {features.map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100"><td className="td font-medium">{k}</td><td className="td text-right tabular-nums">{v === null ? "–" : Number(v).toPrecision(6)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <Disclaimer>{pred.disclaimer ?? "Model estimate for decision support, not proof of fraud."}</Disclaimer>
    </div>
  );
}
