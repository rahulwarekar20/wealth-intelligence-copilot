"use client";

/**
 * Investor profile form: risk tolerance, time horizon and maximum position size.
 * Saving it changes the advice everywhere — the strategy, stock answers,
 * retirement answers, concentration labels and alerts all use these values.
 */
import { useEffect, useState } from "react";
import { getErrorMessage, getProfile, saveProfile } from "@/lib/api";
import type { Profile, RiskTolerance } from "@/lib/types";
import Callout from "../ui/Callout";

const RISK_OPTIONS: { value: RiskTolerance; label: string; description: string }[] = [
  { value: "conservative", label: "Conservative", description: "Protecting what I have matters more than growth." },
  { value: "moderate", label: "Moderate", description: "Steady growth; I can live with some ups and downs." },
  { value: "aggressive", label: "Aggressive", description: "Maximum long-term growth; big swings don't worry me." },
];

// "Medium" concentration starts at 60% of the limit (same rule as the backend)
const MEDIUM_SHARE = 0.6;

export default function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [risk, setRisk] = useState<RiskTolerance>("moderate");
  const [horizon, setHorizon] = useState("");
  const [maxPosition, setMaxPosition] = useState(25);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load the saved profile into the form
  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        setRisk(p.risk_tolerance);
        setHorizon(p.horizon_years === null ? "" : String(p.horizon_years));
        setMaxPosition(p.max_position_pct);
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load your profile.")));
  }, []);

  const save = async () => {
    const years = horizon.trim() === "" ? null : Number(horizon);
    if (years !== null && (!Number.isInteger(years) || years < 0 || years > 80)) {
      setError("Horizon must be a whole number of years between 0 and 80.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      setProfile(await saveProfile({ risk_tolerance: risk, horizon_years: years, max_position_pct: maxPosition }));
      setMessage("Saved. Your next analysis will use this profile.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-6 sm:p-7">
      <h2 className="font-display text-2xl font-medium text-ink-900">Investor profile</h2>
      <p className="mt-1 text-sm text-ink-500">
        {profile && !profile.is_set
          ? "You haven't set a profile yet, so the copilot assumes a moderate investor with a 25% limit."
          : "The copilot tailors every recommendation to these answers."}
      </p>

      {/* Risk tolerance */}
      <fieldset className="mt-6">
        <legend className="eyebrow mb-3">Risk tolerance</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {RISK_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                risk === o.value ? "border-ink-900 bg-paper-50 shadow-card" : "border-paper-300 hover:border-gold-300"
              }`}
            >
              <input
                type="radio"
                name="risk"
                value={o.value}
                checked={risk === o.value}
                onChange={() => setRisk(o.value)}
                className="sr-only"
              />
              <span className="font-display text-lg text-ink-900">{o.label}</span>
              <span className="mt-1 block text-sm text-ink-600">{o.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {/* Horizon */}
        <label className="block">
          <span className="eyebrow">Investment horizon</span>
          <span className="mt-2 flex items-center gap-2">
            <input
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 15"
              className="field w-28 px-3 py-2"
            />
            <span className="text-sm text-ink-600">years until you need the money</span>
          </span>
        </label>

        {/* Maximum position size */}
        <label className="block">
          <span className="eyebrow">Maximum in any one position</span>
          <span className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={maxPosition}
              onChange={(e) => setMaxPosition(Number(e.target.value))}
              className="w-full accent-ink-900"
            />
            <span className="w-12 text-right font-display text-xl tabular-nums text-ink-900">{maxPosition}%</span>
          </span>
          <span className="mt-1 block text-xs text-ink-500">
            Positions above {maxPosition}% are flagged High risk; above {Math.round(maxPosition * MEDIUM_SHARE * 10) / 10}% Medium.
          </span>
        </label>
      </div>

      {error && <Callout tone="error" className="mt-5">{error}</Callout>}
      {message && <Callout tone="success" className="mt-5">{message}</Callout>}

      <button onClick={save} disabled={saving || !profile} className="btn-primary mt-6 px-6 py-2.5 text-sm">
        {saving ? "Saving..." : "Save profile"}
      </button>
    </section>
  );
}
