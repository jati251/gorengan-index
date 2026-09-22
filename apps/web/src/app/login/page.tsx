"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Activity,
  ShieldCheck,
  Lock,
  Globe2,
  ArrowRight,
} from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signIn("google", { callbackUrl });
    } catch (err) {
      console.error("Google sign in error", err);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-[#080d1e]/85 backdrop-blur-2xl border border-white/[0.1] shadow-[0_16px_48px_rgba(0,0,0,0.7)] relative overflow-hidden">
      {/* Subtle background glow highlights */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center space-y-3 relative z-10 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold shadow-[0_0_16px_rgba(16,185,129,0.2)]">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>INSTITUTIONAL MARKET TERMINAL</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
          Gorengan<span className="text-emerald-400">INDEX</span>
        </h1>

        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
          Sign in to access real-time multi-asset liquidity, orderbooks, and low-latency market intelligence.
        </p>
      </div>

      {/* Asset classes badges ticker */}
      <div className="grid grid-cols-4 gap-1.5 mb-7 text-center font-mono text-[10px] relative z-10">
        <div className="py-1 px-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-slate-300">
          ⚡ CRYPTO
        </div>
        <div className="py-1 px-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-blue-400">
          💱 FOREX
        </div>
        <div className="py-1 px-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-cyan-400">
          🇺🇸 US EQ
        </div>
        <div className="py-1 px-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-amber-400">
          🇮🇩 IDX EQ
        </div>
      </div>

      {/* Google Sign In Button */}
      <div className="relative z-10 space-y-4">
        <motion.button
          type="button"
          disabled={isLoading}
          onClick={handleGoogleSignIn}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-all cursor-pointer shadow-[0_4px_20px_rgba(255,255,255,0.15)] disabled:opacity-70 disabled:cursor-not-allowed border border-white/80"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          ) : (
            <GoogleIcon className="w-5 h-5" />
          )}
          <span>{isLoading ? "Connecting to Google..." : "Continue with Google"}</span>
          <ArrowRight className="w-4 h-4 ml-auto text-slate-400" />
        </motion.button>

        {/* Security Assurance Card */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-slate-400 text-xs font-mono">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>256-Bit Encrypted OAuth Session</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Your credentials never touch our servers. Authentication is securely handled directly through Google Identity Services.
          </p>
        </div>
      </div>

      {/* Terminal Footer Info */}
      <div className="mt-8 pt-4 border-t border-white/[0.06] text-center text-[10px] text-slate-500 font-mono relative z-10 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Lock className="w-3 h-3 text-slate-400" />
          Protected Route
        </span>
        <span className="flex items-center gap-1">
          <Globe2 className="w-3 h-3 text-slate-400" />
          Global Feeds
        </span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#030612] text-slate-100 p-4 relative overflow-hidden select-none">
      {/* Background ambient lighting effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/[0.06] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-cyan-500/[0.05] rounded-full blur-[120px] pointer-events-none" />

      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 rounded-2xl bg-[#080d1e]/85 border border-white/[0.08] text-center font-mono text-xs text-slate-400 animate-pulse">
            Loading authentication gateway...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
