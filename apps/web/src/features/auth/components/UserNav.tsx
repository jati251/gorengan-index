"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { ChevronDown, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/features/i18n";
import { useClickOutside } from "@/hooks/useClickOutside";

export function UserNav() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { dict } = useTranslation();

  useClickOutside(menuRef, () => setIsOpen(false), isOpen);

  if (status === "loading") {
    return (
      <span className="user-nav-loading" aria-label={dict.common.loadingAccount}>
        …
      </span>
    );
  }
  if (!session?.user) {
    return (
      <button type="button" className="user-nav-signin" onClick={() => signIn("google")}>
        {dict.common.signIn}
      </button>
    );
  }

  const user = session.user;
  const initial = user.name?.charAt(0).toUpperCase() || "U";
  return (
    <div className="user-nav" ref={menuRef}>
      <button
        type="button"
        className="user-nav-trigger"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((value) => !value)}
      >
        {user.image ? (
          <Image src={user.image} alt="" width={28} height={28} className="user-nav-avatar" />
        ) : (
          <span className="user-nav-initial">{initial}</span>
        )}
        <span className="user-nav-name">{user.name?.split(" ")[0] || dict.common.account}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="user-nav-menu"
            role="menu"
          >
            <div className="user-nav-profile">
              <strong>{user.name || dict.common.account}</strong>
              {user.email && <span>{user.email}</span>}
            </div>
            <button type="button" role="menuitem" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="size-4" /> {dict.common.signOut}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
