"use client";

/**
 * Public landing page ("/"): explains the product and hosts the sign-in form.
 * Each section is its own component in components/landing/; the copy lives in
 * components/landing/content.ts.
 */
import { useRef } from "react";
import {
  ClosingCta,
  ExampleSection,
  Features,
  Hero,
  HowItWorks,
  LandingFooter,
  LandingNav,
  TrustSection,
} from "./components/landing/Sections";
import { SIGN_IN_ANCHOR } from "./components/landing/SignInCard";

export default function LandingPage() {
  const emailRef = useRef<HTMLInputElement>(null);

  // Every "Sign in" / "Open your copilot" button scrolls to the form and focuses email
  const goToSignIn = () => {
    document.getElementById(SIGN_IN_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 400);
  };

  return (
    <div className="min-h-screen">
      <LandingNav onSignIn={goToSignIn} />
      <main id="top">
        <Hero onSignIn={goToSignIn} emailRef={emailRef} />
        <ExampleSection />
        <HowItWorks />
        <Features />
        <TrustSection />
        <ClosingCta onSignIn={goToSignIn} />
      </main>
      <LandingFooter />
    </div>
  );
}
