"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useSession, signOut, signIn } from "next-auth/react";
import { LogOut, ShieldCheck, ChevronDown, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function UserNav() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (status === "loading") {
    return (
      <div className="w-24 h-7 rounded-lg bg-white/[0.04] animate-pulse border border-white/[0.06]" />
    );
  }

  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.15)]"
      >
        <Sparkles className="w-3 h-3 text-emerald-400" />
        <span>Sign In</span>
      </button>
    );
  }

  const user = session.user;
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div className="relative font-mono" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer group"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name || "User Avatar"}
            width={20}
            height={20}
            className="w-5 h-5 rounded-full object-cover ring-1 ring-emerald-500/40"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold">
            {initials}
          </div>
        )}

        <span className="text-[11px] font-medium text-slate-200 group-hover:text-white max-w-[90px] truncate hidden sm:inline">
          {user.name?.split(" ")[0] || "Trader"}
        </span>

        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-emerald-400" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-1.5 w-64 rounded-xl bg-[#090e1f]/95 backdrop-blur-2xl border border-white/[0.1] shadow-[0_12px_36px_rgba(0,0,0,0.65)] p-2 z-50 overflow-hidden"
          >
            {/* User Profile Header */}
            <div className="p-2 border-b border-white/[0.06] mb-1">
              <div className="flex items-center gap-2.5">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || "User Avatar"}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500/50"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center text-xs font-bold">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">
                    {user.name || "Authenticated Trader"}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {user.email || "No email"}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Google OAuth Verified</span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-0.5">
              <div className="px-2 py-1.5 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Account Role</span>
                <span className="font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40 text-[9px]">
                  PRO TERMINAL
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 transition-colors cursor-pointer border border-transparent hover:border-rose-500/30"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
