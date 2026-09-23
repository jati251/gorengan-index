"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, ArrowRight } from "lucide-react";

function GoogleIcon() {
  return <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/terminal";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(false);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError(true);
      setIsLoading(false);
    }
  };

  return <main className="login-page">
    <div className="login-shell">
      <Link href="/" className="login-back"><ArrowLeft className="size-4" /> Back to markets</Link>
      <div className="login-content">
        <div className="login-identity"><span className="brand-mark" aria-hidden="true">G<span>.</span></span><span>Gorengan <strong>Index</strong></span></div>
        <p className="eyebrow">Your workspace</p>
        <h1>Pick up where<br /><em>the market is.</em></h1>
        <p className="login-description">Sign in to open your watchlist, charts, and market news in the terminal.</p>
        <button type="button" onClick={handleSignIn} disabled={isLoading} className="login-google"><GoogleIcon /><span>{isLoading ? "Connecting to Google…" : "Continue with Google"}</span><ArrowRight className="size-4" /></button>
        {error && <p role="alert" className="login-error">Sign-in did not start. Please try again.</p>}
        <p className="login-footnote">You will continue through Google sign-in.</p>
      </div>
      <p className="login-bottom">Gorengan Index · Market data for personal research</p>
    </div>
    <div className="login-aside" aria-hidden="true"><div className="login-aside-inner"><span>MARKET / 01</span><p>One place to watch what moves.</p><div className="login-aside-rule" /><span>CHARTS &nbsp;·&nbsp; WATCHLIST &nbsp;·&nbsp; NEWS</span></div></div>
  </main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="login-page"><p className="m-auto text-sm">Loading sign-in…</p></main>}><LoginForm /></Suspense>;
}
