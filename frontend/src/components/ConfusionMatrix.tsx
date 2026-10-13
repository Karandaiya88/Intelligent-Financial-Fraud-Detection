import { int } from "@/lib/format";

export function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const [[tn, fp], [fn, tp]] = matrix;
  const cell = "flex flex-col items-center justify-center rounded-lg p-4 text-center";
  return (
    <div>
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-xs">
        <span />
        <span className="text-center font-semibold text-slate-500">Predicted non-fraud</span>
        <span className="text-center font-semibold text-slate-500">Predicted fraud</span>
        <span className="pr-2 text-right font-semibold text-slate-500">Actual non-fraud</span>
        <div className={`${cell} bg-emerald-50`}><span className="text-xl font-bold text-emerald-700">{int(tn)}</span><span className="text-slate-500">True negatives</span></div>
        <div className={`${cell} bg-amber-50`}><span className="text-xl font-bold text-amber-700">{int(fp)}</span><span className="text-slate-500">False positives (legit flagged)</span></div>
        <span className="pr-2 text-right font-semibold text-slate-500">Actual fraud</span>
        <div className={`${cell} bg-red-50`}><span className="text-xl font-bold text-red-700">{int(fn)}</span><span className="text-slate-500">False negatives (fraud missed)</span></div>
        <div className={`${cell} bg-emerald-50`}><span className="text-xl font-bold text-emerald-700">{int(tp)}</span><span className="text-slate-500">True positives</span></div>
      </div>
    </div>
  );
}
