"use client";

/**
 * Sign-in / create-account form on the landing page.
 * On success it stores the token, clears any previous user's session data and
 * opens the dashboard. Clicking the demo box fills in the demo credentials.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGOUT_REASON_KEY, getErrorMessage, login, signup } from "@/lib/api";
import { clearSessionStore } from "@/lib/sessionStore";
import Callout from "../ui/Callout";
import { IconArrowRight } from "../ui/Icons";
import { DEMO_CREDENTIALS } from "./content";

/** Anchor id other sections scroll to when the visitor clicks "Sign in". */
export const SIGN_IN_ANCHOR = "signin";

export default function SignInCard({ emailRef }: { emailRef: React.RefObject<HTMLInputElement | null> }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  // If the user was signed out because their session expired, say so (once)
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(LOGOUT_REASON_KEY) === "expired") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage once on mount
        setExpired(true);
        localStorage.removeItem(LOGOUT_REASON_KEY);
      }
    } catch {}
  }, []);

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

  const toggleMode = () => {
    setMode(isSignup ? "login" : "signup");
    setError("");
  };

  const fillDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setError("");
  };

  return (
    <div id={SIGN_IN_ANCHOR} className="card relative scroll-mt-24 p-8 shadow-book">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-300 to-transparent" />

      <p className="eyebrow text-gold-500">{isSignup ? "Open an account" : "Members"}</p>
      <h2 className="mt-1 font-display text-3xl font-medium text-ink-900">
        {isSignup ? "Start your ledger" : "Welcome back"}
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        {isSignup ? "Free to try. Takes less than a minute." : "Sign in to your portfolio and copilot."}
      </p>

      {expired && (
        <Callout tone="note" className="mt-4 py-2">
          Your session expired after a period of inactivity. Please sign in again.
        </Callout>
      )}

      <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Email</span>
          <input
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field mt-1.5 px-4 py-3"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-1.5 px-4 py-3"
            placeholder={isSignup ? "At least 8 characters" : "••••••••"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            maxLength={72}
          />
        </label>

        {error && <Callout tone="error" className="py-2">{error}</Callout>}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? (isSignup ? "Creating account..." : "Signing in...") : isSignup ? "Create account" : "Sign in"}
          {!loading && <IconArrowRight size={16} />}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-600">
        {isSignup ? "Already have an account?" : "New here?"}{" "}
        <button onClick={toggleMode} className="link font-semibold">
          {isSignup ? "Sign in" : "Create an account"}
        </button>
      </p>

      {/* Demo credentials — click to fill the form */}
      {!isSignup && (
        <button
          type="button"
          onClick={fillDemo}
          className="card-inset mt-6 block w-full px-4 py-3 text-center transition hover:border-gold-300"
        >
          <span className="eyebrow">Demo account · click to fill</span>
          <span className="mt-1 block font-mono text-sm text-ink-700">
            {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
          </span>
        </button>
      )}
    </div>
  );
}
