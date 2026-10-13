"use client";
import { useRef, useState } from "react";

export function UploadDropzone({ onFile, disabled, busy, accept = [".csv", ".xlsx"], title = "Drop a file here or click to browse", hint }: {
  onFile: (file: File) => void; disabled?: boolean; busy?: boolean; accept?: string[]; title?: string; hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function handle(file: File | undefined) {
    if (!file) return;
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!accept.includes(ext)) {
      setLocalError(`Unsupported file type "${ext}". Allowed: ${accept.join(", ")}`);
      return;
    }
    setLocalError(null);
    onFile(file);
  }

  return (
    <div>
      <div
        role="button" tabIndex={0} aria-disabled={disabled || busy}
        onClick={() => !disabled && !busy && input.current?.click()}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !disabled && !busy) input.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled && !busy) handle(e.dataTransfer.files?.[0]); }}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          over ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-brand-500"
        } ${disabled || busy ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <p className="text-sm font-semibold text-slate-700">{busy ? "Uploading…" : title}</p>
        <p className="mt-1 text-xs text-slate-500">{hint ?? `Accepted: ${accept.join(", ")}`}</p>
        <input
          ref={input} type="file" accept={accept.join(",")} className="hidden"
          onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>
      {localError && <p className="mt-2 text-sm text-red-600" role="alert">{localError}</p>}
    </div>
  );
}
