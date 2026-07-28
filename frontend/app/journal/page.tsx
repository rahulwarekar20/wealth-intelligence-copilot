"use client";

import { useEffect, useState } from "react";
import { getJournal } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JournalPage() {
  const router = useRouter();
  const [journal, setJournal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    loadJournal();
  }, []);

  const loadJournal = async () => {
    try {
      const data = await getJournal();
      setJournal(data);
    } catch (err) {
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case "buy": return "bg-green-900 text-green-300";
      case "sell": return "bg-red-900 text-red-300";
      case "hold": return "bg-yellow-900 text-yellow-300";
      case "rebalance": return "bg-blue-900 text-blue-300";
      default: return "bg-gray-800 text-gray-300";
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-teal-400 text-xl animate-pulse">
          Loading journal...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-teal-400">
          Wealth Intelligence Copilot
        </h1>
        <div className="flex gap-4 items-center">
          <Link href="/dashboard" className="text-gray-300 hover:text-teal-400 transition">
           Dashboard
          </Link>
          <Link href="/strategy" className="text-gray-300 hover:text-teal-400 transition">
           Strategy
          </Link>
          <Link href="/chat" className="text-gray-300 hover:text-teal-400 transition">
           Chat
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">
          Decision Journal
        </h2>

        {journal.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
            <p className="text-gray-400 text-lg">No decisions yet</p>
            <p className="text-gray-600 text-sm mt-2">
              Go to the chat and ask your first investment question
            </p>
            <Link
              href="/chat"
              className="inline-block mt-4 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition"
            >
              Start Chatting →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {journal.map((entry: any) => (
              <div
                key={entry.decision_id}
                className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-gray-600 transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-teal-400 font-bold text-lg">
                      {entry.ticker}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-sm font-semibold uppercase ${
                      getActionColor(entry.recommendation?.action)
                    }`}>
                      {entry.recommendation?.action}
                    </span>
                    {entry.recommendation?.disagreement_flag && (
                      <span className="px-2 py-1 bg-orange-900 text-orange-300 text-xs rounded">
                        ⚠️ Agents disagreed
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 text-sm">
                    {new Date(entry.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>

                <p className="text-gray-400 text-sm mb-3 italic">
                  "{entry.query}"
                </p>

                <p className="text-gray-200 text-sm mb-4">
                  {entry.recommendation?.summary}
                </p>

                <div className="flex gap-6">
                  <div>
                    <p className="text-gray-500 text-xs">Confidence</p>
                    <p className={`font-semibold ${
                      entry.confidence >= 0.7
                        ? "text-green-400"
                        : entry.confidence >= 0.4
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}>
                      {Math.round(entry.confidence * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Evidence Diversity</p>
                    <p className="text-gray-300 font-semibold">
                      {Math.round(entry.evidence_diversity_score * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Prompt Version</p>
                    <p className="text-gray-300 font-semibold">
                      {entry.recommendation?.prompt_version}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}