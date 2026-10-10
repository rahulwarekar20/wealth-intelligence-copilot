"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "../components/PageLayout";

export default function RetirePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    currentAge: 35,
    retirementAge: 65,
    currentSavings: 50000,
    monthlyContribution: 1000,
    expectedReturn: 7,
    inflationRate: 3,
    monthlyExpenses: 5000,
  });
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const years = form.retirementAge - form.currentAge;
    const monthlyRate = form.expectedReturn / 100 / 12;
    const months = years * 12;

    // Future value of current savings
    const fvCurrentSavings =
      form.currentSavings * Math.pow(1 + monthlyRate, months);

    // Future value of monthly contributions
    const fvContributions =
      form.monthlyContribution *
      ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

    const totalAtRetirement = fvCurrentSavings + fvContributions;

    // Monthly expenses adjusted for inflation at retirement
    const inflationFactor = Math.pow(
      1 + form.inflationRate / 100,
      years
    );
    const adjustedMonthlyExpenses = form.monthlyExpenses * inflationFactor;

    // How many years the fund lasts (4% withdrawal rule approximation)
    const annualWithdrawal = adjustedMonthlyExpenses * 12;
    const yearsUntilDepleted = totalAtRetirement / annualWithdrawal;

    // Can they retire?
    const canRetire = yearsUntilDepleted >= 25;

    // Shortfall or surplus
    const targetNeeded = annualWithdrawal * 25;
    const gap = totalAtRetirement - targetNeeded;

    // Additional monthly savings needed if short
    const additionalNeeded =
      gap < 0
        ? Math.abs(gap) /
          ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
        : 0;

    setResult({
      totalAtRetirement: Math.round(totalAtRetirement),
      adjustedMonthlyExpenses: Math.round(adjustedMonthlyExpenses),
      yearsUntilDepleted: Math.round(yearsUntilDepleted),
      canRetire,
      targetNeeded: Math.round(targetNeeded),
      gap: Math.round(gap),
      additionalNeeded: Math.round(additionalNeeded),
      years,
    });
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  return (
    <PageLayout>
      <div className="px-8 py-8 max-w-4xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Retirement Planner</h1>
          <p className="text-gray-400 mt-1">
            Answer "When can I retire?" — enter your numbers and see the projection
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* Input form */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-bold text-white mb-4">Your Details</h2>
            <div className="space-y-4">
              {[
                { key: "currentAge", label: "Current Age", unit: "years", tip: "Your age today. Used to calculate how many years you have left to save before retirement." },
                { key: "retirementAge", label: "Target Retirement Age", unit: "years", tip: "The age at which you plan to stop working. Common targets are 60, 65, or 67." },
                { key: "currentSavings", label: "Current Savings", unit: "$", tip: "Total amount you have already saved and invested today — 401k, IRA, brokerage accounts combined." },
                { key: "monthlyContribution", label: "Monthly Contribution", unit: "$/mo", tip: "How much you add to your savings every month, including employer 401k match if applicable." },
                { key: "expectedReturn", label: "Expected Annual Return", unit: "%", tip: "Expected average annual investment return. Historically the S&P 500 has returned ~7% after inflation. Use 5-7% for a conservative estimate." },
                { key: "inflationRate", label: "Inflation Rate", unit: "%", tip: "Average annual price increase. The US long-term average is ~3%. This adjusts your future expenses to today's dollars." },
                { key: "monthlyExpenses", label: "Monthly Expenses in Retirement", unit: "$/mo", tip: "How much you expect to spend per month in retirement. A common rule of thumb is 70-80% of your current monthly income." },
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                    {field.label} ({field.unit})
                    <span className="relative group cursor-help">
                      <span className="w-4 h-4 rounded-full bg-gray-700 text-gray-300 text-xs flex items-center justify-center font-bold">?</span>
                      <span className="absolute left-6 top-0 w-56 bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg p-2 hidden group-hover:block z-10 shadow-xl leading-relaxed">
                        {field.tip}
                      </span>
                    </span>
                  </label>
                  <input
                    type="number"
                    value={form[field.key as keyof typeof form]}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [field.key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-teal-400 text-sm"
                  />
                </div>
              ))}

              <button
                onClick={calculate}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl transition mt-2"
              >
                Calculate
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {!result && (
              <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center h-full flex flex-col items-center justify-center">
                <p className="text-4xl mb-3">🏖️</p>
                <p className="text-gray-400">Enter your details and click Calculate to see your retirement projection</p>
              </div>
            )}

            {result && (
              <>
                {/* Can you retire? */}
                <div className={`rounded-2xl p-6 border ${
                  result.canRetire
                    ? "bg-green-950 border-green-800"
                    : "bg-red-950 border-red-800"
                }`}>
                  <p className="text-2xl mb-2">{result.canRetire ? "✅" : "⚠️"}</p>
                  <p className={`text-xl font-bold mb-1 ${result.canRetire ? "text-green-300" : "text-red-300"}`}>
                    {result.canRetire
                      ? `Yes — you can retire at ${form.retirementAge}`
                      : `Not yet — you need more savings`}
                  </p>
                  <p className="text-gray-300 text-sm">
                    {result.canRetire
                      ? `Your fund lasts ~${result.yearsUntilDepleted} years — well beyond a 25-year target`
                      : `At current savings rate, your fund lasts ~${result.yearsUntilDepleted} years`}
                  </p>
                </div>

                {/* Key numbers */}
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <h2 className="text-lg font-bold text-white mb-4">Projection ({result.years} years)</h2>
                  <div className="space-y-3">
                    {[
                      { label: "Total at retirement", value: fmt(result.totalAtRetirement), color: "text-teal-400" },
                      { label: "Monthly expenses (inflation-adjusted)", value: fmt(result.adjustedMonthlyExpenses), color: "text-white" },
                      { label: "Target needed (25-year rule)", value: fmt(result.targetNeeded), color: "text-white" },
                      {
                        label: result.gap >= 0 ? "Surplus" : "Shortfall",
                        value: fmt(Math.abs(result.gap)),
                        color: result.gap >= 0 ? "text-green-400" : "text-red-400"
                      },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center border-b border-gray-800 pb-2">
                        <p className="text-gray-400 text-sm">{row.label}</p>
                        <p className={`font-bold ${row.color}`}>{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action if short */}
                {!result.canRetire && result.additionalNeeded > 0 && (
                  <div className="bg-yellow-950 border border-yellow-800 rounded-2xl p-5">
                    <p className="text-yellow-300 font-bold mb-1">What you need to do</p>
                    <p className="text-gray-300 text-sm">
                      Save an additional{" "}
                      <span className="text-yellow-300 font-bold">
                        {fmt(result.additionalNeeded)}/month
                      </span>{" "}
                      to retire comfortably at {form.retirementAge}.
                    </p>
                    <p className="text-gray-400 text-xs mt-2">
                      Or consider retiring later, reducing planned expenses, or increasing your investment returns.
                    </p>
                  </div>
                )}

                <p className="text-gray-600 text-xs">
                  Based on standard financial planning assumptions. Not personalized investment advice.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}