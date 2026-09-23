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
    <main className="login-page h-[100dvh] max-h-[100dvh] w-full overflow-hidden select-none">
      {/* Left panel: Auth shell */}
      <div className="login-shell flex flex-col justify-between h-full max-h-[100dvh] overflow-hidden py-4 sm:py-6 px-6 sm:px-10 md:px-14">
        <Link href="/" className="login-back hover:text-white transition-colors self-start">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to markets</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="login-content my-auto mx-auto w-full max-w-[410px] flex flex-col justify-center"
        >
          <div className="login-identity mb-2.5 sm:mb-4">
            <span className="brand-mark inline-flex items-center justify-center font-bold text-base border border-current mr-2 w-7 h-7 rounded-sm" aria-hidden="true">
              G<span className="text-[#f4c41b]">.</span>
            </span>
            <span className="text-sm sm:text-base font-bold tracking-tight">
              Gorengan <strong className="text-[#f4c41b] font-extrabold">Index</strong>
            </span>
          </div>

          <p className="eyebrow text-[11px] sm:text-xs uppercase tracking-widest text-[#f4c41b] font-mono mb-1">
            Your workspace
          </p>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-normal leading-[1.04] tracking-tight text-[#c3e6eb] mb-2">
            Pick up where<br />
            <em className="text-[#f4c41b] not-italic">the market is.</em>
          </h1>

          <p className="login-description text-xs sm:text-sm text-[#c3e6eb]/80 leading-normal my-2 sm:my-3 max-w-[370px]">
            Sign in to open your watchlist, real-time charts, and market news in the institutional terminal.
          </p>

          {/* Negative state: Error feedback banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -4 }}
                className="mb-2.5 p-2 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
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
            className="login-google cursor-pointer transition-colors shadow-sm disabled:cursor-wait mt-1 w-full"
          >
            <div className="flex items-center gap-2.5">
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-[#2a2839] border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span className="font-semibold text-sm">
                {isLoading ? "Connecting to Google…" : "Continue with Google"}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#2a2839]/70" />
          </motion.button>

          <p className="login-footnote text-[10px] sm:text-[11px] text-[#c3e6eb]/60 font-mono mt-2">
            Authentication is securely verified through Google OAuth.
          </p>
        </motion.div>

        <p className="login-bottom text-[10px] sm:text-[11px] text-[#c3e6eb]/50 font-mono">
          Gorengan Index · Market data for personal research
        </p>
      </div>

      {/* Right panel: Editorial aside split */}
      <div className="login-aside flex items-center justify-center p-6 lg:p-12 bg-[#3c3f5f] border-l border-[#55607e] overflow-hidden" aria-hidden="true">
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="login-aside-inner w-full max-w-[460px]"
        >
          <span className="text-[#f4c41b] text-xs font-bold font-mono tracking-widest block">
            MARKET / 01
          </span>
          <p className="text-2xl lg:text-4xl leading-[1.06] text-[#c3e6eb] my-3 lg:my-5">
            One place to watch what moves.
          </p>
          <div className="login-aside-rule h-px bg-[#757e8a] mb-3.5" />
          <span className="text-[10px] sm:text-[11px] text-[#c3e6eb]/70 font-mono tracking-wider">
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
