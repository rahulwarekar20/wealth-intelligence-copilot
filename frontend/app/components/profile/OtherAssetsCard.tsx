"use client";

/**
 * Other assets (cash, bonds, property, other): list with a total, an add
 * form and delete buttons. These count toward net worth on the dashboard and
 * are given to the retirement and strategy agents.
 */
import { useCallback, useEffect, useState } from "react";
import { addAsset, deleteAsset, getErrorMessage, listAssets } from "@/lib/api";
import type { AssetClass, OtherAsset } from "@/lib/types";
import { formatMoney } from "@/lib/ui";
import Callout from "../ui/Callout";
import { IconClose, IconPlus } from "../ui/Icons";

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  cash: "Cash",
  bonds: "Bonds",
  property: "Property",
  other: "Other",
};

const EMPTY = { name: "", asset_class: "cash" as AssetClass, value: "" };

export default function OtherAssetsCard() {
  const [assets, setAssets] = useState<OtherAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listAssets();
      setAssets(data.assets);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your assets."));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after the request resolves
    load();
  }, [load]);

  const add = async () => {
    const value = Number(form.value.replace(/[$,\s]/g, ""));
    if (!form.name.trim()) return setError("Give the asset a name, e.g. \"Emergency fund\".");
    if (!Number.isFinite(value) || value < 0) return setError("Enter the asset's current value.");
    setSaving(true);
    setError("");
    try {
      await addAsset({ name: form.name.trim(), asset_class: form.asset_class, value });
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not add the asset."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (asset: OtherAsset) => {
    if (!window.confirm(`Remove ${asset.name}?`)) return;
    try {
      await deleteAsset(asset.id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not remove the asset."));
    }
  };

  return (
    <section className="card p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-medium text-ink-900">Other assets</h2>
        <span className="font-display text-xl tabular-nums text-ink-900">{formatMoney(total, 0)}</span>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        Cash, bonds and property you own outside your stock portfolio. They count toward your net worth and
        retirement plan.
      </p>

      {assets.length > 0 && (
        <ul className="mt-5 divide-y divide-paper-200 border-y border-paper-200">
          {assets.map((a) => (
            <li key={a.id} className="group flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink-900">{a.name}</p>
                <p className="text-xs text-ink-500">{ASSET_CLASS_LABELS[a.asset_class]}</p>
              </div>
              <span className="tabular-nums text-ink-800">{formatMoney(a.value, 0)}</span>
              <button
                onClick={() => remove(a)}
                aria-label={`Remove ${a.name}`}
                className="rounded p-1 text-ink-400 transition hover:bg-brick-50 hover:text-brick-500"
              >
                <IconClose size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add an asset */}
      <div className="card-inset mt-5 p-4">
        <p className="eyebrow mb-3">Add an asset</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name, e.g. Emergency fund"
            maxLength={80}
            className="field col-span-2 px-3 py-2 text-sm"
          />
          <select
            value={form.asset_class}
            onChange={(e) => setForm({ ...form, asset_class: e.target.value as AssetClass })}
            className="field px-3 py-2 text-sm"
            aria-label="Asset type"
          >
            {Object.entries(ASSET_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Value ($)"
            inputMode="decimal"
            className="field px-3 py-2 text-sm"
          />
        </div>
        {error && <Callout tone="error" className="mt-3 py-2">{error}</Callout>}
        <button onClick={add} disabled={saving} className="btn-primary mt-3 w-full py-2.5 text-sm">
          <IconPlus size={16} /> {saving ? "Adding..." : "Add asset"}
        </button>
      </div>
    </section>
  );
}
