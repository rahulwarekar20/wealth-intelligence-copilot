"use client";

/**
 * Import holdings from a brokerage file, in two steps:
 *   1. Pick a CSV export or PDF statement → the backend reads it (CSV directly,
 *      PDFs by the AI) and returns a preview. Nothing is saved yet.
 *   2. Review the rows, untick any to skip, choose "add" or "replace", confirm.
 */
import { useRef, useState } from "react";
import { confirmImport, getErrorMessage, previewImport } from "@/lib/api";
import type { ImportRow } from "@/lib/types";
import { formatMoney } from "@/lib/ui";
import Callout from "../ui/Callout";
import { IconClose, IconUpload } from "../ui/Icons";

const ACCOUNT_LABELS: Record<string, string> = { taxable: "Taxable", ira: "IRA", roth_ira: "Roth IRA", "401k": "401(k)" };

export default function ImportHoldings({ onImported, onClose }: { onImported: () => void; onClose: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [method, setMethod] = useState<"csv" | "ai">("csv");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState<"" | "reading" | "saving">("");
  const [error, setError] = useState("");

  /** Step 1: send the file for a preview. */
  const read = async (file: File | undefined) => {
    if (!file) return;
    setBusy("reading");
    setError("");
    try {
      const preview = await previewImport(file);
      setRows(preview.holdings);
      setSelected(preview.holdings.map(() => true));
      setMethod(preview.method);
    } catch (err) {
      setError(getErrorMessage(err, "Could not read this file."));
    } finally {
      setBusy("");
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  /** Step 2: save the ticked rows. */
  const save = async () => {
    const chosen = (rows ?? []).filter((_, i) => selected[i]);
    if (!chosen.length) return setError("Tick at least one holding to import.");
    if (replace && !window.confirm("Replace ALL your current holdings with these?")) return;
    setBusy("saving");
    setError("");
    try {
      await confirmImport(chosen, replace);
      onImported();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not import these holdings."));
    } finally {
      setBusy("");
    }
  };

  const count = selected.filter(Boolean).length;

  return (
    <div className="card-inset mb-5 p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg text-ink-900">Import from your broker</p>
          <p className="text-sm text-ink-600">
            Upload a positions CSV export or a PDF statement. You&apos;ll review everything before it&apos;s saved.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close import" className="rounded p-1 text-ink-500 hover:bg-paper-200">
          <IconClose size={16} />
        </button>
      </div>

      {!rows && (
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy === "reading"}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-paper-400 bg-paper-50 p-6 text-sm text-ink-600 transition hover:border-gold-400"
        >
          <IconUpload size={22} className="text-gold-500" />
          {busy === "reading" ? "Reading your file… (PDF statements take up to 30 seconds)" : "Choose a CSV or PDF (max 5 MB)"}
        </button>
      )}
      <input ref={fileInput} type="file" accept=".csv,.pdf,.txt" className="hidden" onChange={(e) => read(e.target.files?.[0])} />

      {rows && (
        <>
          <p className="mb-2 text-xs text-ink-500">
            Found {rows.length} holding{rows.length === 1 ? "" : "s"}
            {method === "ai" ? " — read by the AI, so please check each row carefully." : "."}
          </p>
          <div className="max-h-72 overflow-auto rounded-lg border border-paper-300 bg-paper-50">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-paper-100">
                <tr className="text-left">
                  <th className="px-3 py-2" />
                  <th className="eyebrow px-3 py-2">Ticker</th>
                  <th className="eyebrow px-3 py-2 text-right">Qty</th>
                  <th className="eyebrow px-3 py-2 text-right">Cost / share</th>
                  <th className="eyebrow px-3 py-2">Account</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r, i) => (
                  <tr key={`${r.ticker}-${i}`} className="border-t border-paper-200">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected[i]}
                        onChange={() => setSelected(selected.map((v, j) => (j === i ? !v : v)))}
                        aria-label={`Import ${r.ticker}`}
                        className="accent-ink-900"
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold text-ink-900">{r.ticker}</td>
                    <td className="px-3 py-2 text-right">{r.quantity}</td>
                    <td className="px-3 py-2 text-right">{r.cost_basis === null ? "—" : formatMoney(r.cost_basis)}</td>
                    <td className="px-3 py-2 text-ink-600">{ACCOUNT_LABELS[r.account_type] ?? r.account_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-700">
            <label className="flex items-center gap-2">
              <input type="radio" checked={!replace} onChange={() => setReplace(false)} className="accent-ink-900" />
              Add to my current holdings
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={replace} onChange={() => setReplace(true)} className="accent-ink-900" />
              Replace my current holdings
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={save} disabled={busy === "saving" || !count} className="btn-primary px-5 py-2.5 text-sm">
              {busy === "saving" ? "Importing..." : `Import ${count} holding${count === 1 ? "" : "s"}`}
            </button>
            <button onClick={() => setRows(null)} className="btn-secondary px-4 py-2.5 text-sm">Choose another file</button>
          </div>
        </>
      )}

      {error && <Callout tone="error" className="mt-3 py-2">{error}</Callout>}
    </div>
  );
}
