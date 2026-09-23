"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/terminal";
  const urlError = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? "Authentication session expired or failed. Please try again." : null
  );

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("Sign-in did not start. Please verify your connection and try again.");
      setIsLoading(false);
    }
  };

  return (
    <main className="login-page h-[100dvh] max-h-[100dvh] overflow-hidden">
      {/* Left panel: Auth shell */}
      <div className="login-shell justify-between py-5 sm:py-7 px-6 sm:px-12 md:px-16 overflow-y-auto">
        <Link href="/" className="login-back hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to markets</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="login-content my-auto py-2 sm:py-4 max-w-[440px]"
        >
          <div className="login-identity mb-4 sm:mb-6">
            <span className="brand-mark inline-flex items-center justify-center font-serif font-bold text-lg border border-current mr-2.5 w-8 h-8 rounded-sm" aria-hidden="true">
              G<span className="text-[#f4c41b]">.</span>
            </span>
            <span className="text-base font-bold tracking-tight">
              Gorengan <strong className="text-[#f4c41b] font-extrabold">Index</strong>
            </span>
          </div>

          <p className="eyebrow text-xs uppercase tracking-widest text-[#f4c41b] font-mono mb-2">
            Your workspace
          </p>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal leading-[1.08] tracking-tight text-[#c3e6eb] mb-3">
            Pick up where<br />
            <em className="text-[#f4c41b] italic">the market is.</em>
          </h1>

          <p className="login-description text-xs sm:text-sm text-[#c3e6eb]/80 leading-relaxed my-3 sm:my-4 max-w-[390px]">
            Sign in to open your watchlist, real-time charts, and market news in the institutional terminal.
          </p>

          {/* Negative state: Error feedback banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -4 }}
                className="mb-3.5 p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={handleSignIn}
            disabled={isLoading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="login-google cursor-pointer transition-colors shadow-sm disabled:cursor-wait mt-2"
          >
            <div className="flex items-center gap-3">
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-[#2a2839] border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span className="font-semibold text-sm">
                {isLoading ? "Connecting to Google…" : "Continue with Google"}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#2a2839]/70" />
          </motion.button>

          <p className="login-footnote text-[11px] text-[#c3e6eb]/60 font-mono mt-3">
            Authentication is securely verified through Google OAuth.
          </p>
        </motion.div>

        <p className="login-bottom text-[11px] text-[#c3e6eb]/50 font-mono pt-2">
          Gorengan Index · Market data for personal research
        </p>
      </div>

      {/* Right panel: Editorial aside split */}
      <div className="login-aside flex items-end p-8 lg:p-14 bg-[#3c3f5f] border-l border-[#55607e]" aria-hidden="true">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="login-aside-inner w-full"
        >
          <span className="text-[#f4c41b] text-xs font-bold font-mono tracking-widest block">
            MARKET / 01
          </span>
          <p className="text-3xl lg:text-5xl font-serif leading-[1.08] text-[#c3e6eb] my-4 lg:my-6 max-w-[480px]">
            One place to watch what moves.
          </p>
          <div className="login-aside-rule h-px bg-[#757e8a] mb-5" />
          <span className="text-[11px] text-[#c3e6eb]/70 font-mono tracking-wider">
            CHARTS &nbsp;·&nbsp; WATCHLIST &nbsp;·&nbsp; NEWS
          </span>
        </motion.div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="login-page h-[100dvh] flex items-center justify-center">
          <p className="m-auto text-sm text-[#c3e6eb] font-mono animate-pulse">
            Loading sign-in…
          </p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
