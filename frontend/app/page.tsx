"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage, login, signup } from "@/lib/api";
import { clearSessionStore } from "@/lib/sessionStore";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    if (isSignup && password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = isSignup ? await signup(email.trim(), password) : await login(email.trim(), password);
      // Start every login with a clean session (no other user's cached chats/strategy)
      try { sessionStorage.clear(); } catch {}
      clearSessionStore();
      localStorage.setItem("token", data.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, isSignup ? "Could not create account" : "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-400">
            Wealth Intelligence
          </h1>
          <p className="text-gray-400 mt-2">
            AI-powered investment decision support
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-teal-400"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full mt-1 px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-teal-400"
              placeholder={isSignup ? "At least 8 characters" : "••••••••"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              maxLength={72}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-lg transition disabled:opacity-50"
          >
            {loading ? (isSignup ? "Creating account..." : "Signing in...") : isSignup ? "Create Account" : "Sign In"}
          </button>

          <p className="text-gray-400 text-sm text-center">
            {isSignup ? "Already have an account?" : "New here?"}{" "}
            <button
              onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); }}
              className="text-teal-400 hover:text-teal-300 font-semibold"
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>

        {/* Demo credentials */}
        {!isSignup && (
          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-sm text-center">Demo credentials</p>
            <p className="text-gray-300 text-sm text-center mt-1">
              test@example.com / testpass123
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
