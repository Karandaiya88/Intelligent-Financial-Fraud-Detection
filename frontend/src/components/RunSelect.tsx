"use client";
import type { ModelRun } from "@/lib/types";
import { MODEL_LABELS } from "@/lib/format";

export function RunSelect({ runs, value, onChange, label = "Model run", id = "run-select" }: {
  runs: ModelRun[]; value: number | null; onChange: (id: number) => void; label?: string; id?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} disabled={runs.length === 0}>
        {runs.length === 0 && <option value="">No trained models yet</option>}
        {runs.map((r) => (
          <option key={r.model_run_id} value={r.model_run_id}>
            #{r.model_run_id} · {MODEL_LABELS[r.model_name] ?? r.model_name} · dataset {r.dataset_id}{r.is_best ? " · ★ best" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
