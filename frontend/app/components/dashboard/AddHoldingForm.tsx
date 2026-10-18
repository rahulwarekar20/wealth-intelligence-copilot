"use client";

/**
 * Form for adding a holding (ticker, quantity, optional cost per share, account type).
 * Validates input locally, then calls `onAdd`; a thrown error is shown under the form.
 */
import { useState } from "react";
import { getErrorMessage } from "@/lib/api";
import type { NewHolding } from "@/lib/usePortfolio";
import { IconPlus } from "../ui/Icons";

const EMPTY_FORM = { ticker: "", quantity: "", cost_basis: "", account_type: "taxable" };

const ACCOUNT_OPTIONS = [
  { value: "taxable", label: "Taxable" },
  { value: "ira", label: "IRA" },
  { value: "roth_ira", label: "Roth IRA" },
  { value: "401k", label: "401(k)" },
];

/** Turns the raw form strings into a holding, or returns an error message. */
function parseForm(form: typeof EMPTY_FORM): NewHolding | string {
  const quantity = Number(form.quantity);
  const costBasis = form.cost_basis.trim() === "" ? null : Number(form.cost_basis);
  if (!form.ticker.trim()) return "Enter a ticker.";
  if (!Number.isFinite(quantity) || quantity <= 0) return "Quantity must be greater than 0.";
  if (costBasis !== null && (!Number.isFinite(costBasis) || costBasis < 0)) return "Cost basis must be 0 or more.";
  return { ticker: form.ticker.trim().toUpperCase(), quantity, cost_basis: costBasis, account_type: form.account_type };
}

export default function AddHoldingForm({ onAdd }: { onAdd: (holding: NewHolding) => Promise<void> }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = parseForm(form);
    if (typeof parsed === "string") return setError(parsed);

    setSaving(true);
    setError("");
    try {
      await onAdd(parsed);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(getErrorMessage(err, "Could not add holding."));
    } finally {
      setSaving(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && submit();

  return (
    <div className="card-inset mt-5 p-4">
      <p className="eyebrow mb-3">Add a holding</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          value={form.ticker}
          onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
          onKeyDown={onEnter}
          placeholder="Ticker"
          maxLength={10}
          className="field px-3 py-2 text-sm uppercase"
        />
        <input
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          onKeyDown={onEnter}
          placeholder="Quantity"
          inputMode="decimal"
          className="field px-3 py-2 text-sm"
        />
        <input
          value={form.cost_basis}
          onChange={(e) => setForm({ ...form, cost_basis: e.target.value })}
          onKeyDown={onEnter}
          placeholder="Cost / share"
          inputMode="decimal"
          className="field px-3 py-2 text-sm"
        />
        <select
          value={form.account_type}
          onChange={(e) => setForm({ ...form, account_type: e.target.value })}
          className="field px-3 py-2 text-sm"
        >
          {ACCOUNT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {error && <p className="mt-2 text-xs text-brick-500">{error}</p>}
      <button onClick={submit} disabled={saving} className="btn-primary mt-3 w-full py-2.5 text-sm">
        <IconPlus size={16} /> {saving ? "Adding..." : "Add holding"}
      </button>
    </div>
  );
}
