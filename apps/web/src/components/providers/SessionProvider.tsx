"use client";

import React, { useEffect, useMemo } from "react";
import {
  SessionProvider as NextAuthSessionProvider,
  useSession,
  signIn,
  SessionContext,
} from "next-auth/react";
import type { Session } from "next-auth";

const isDevAuthBypass =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

const DEV_MOCK_SESSION: Session = {
  user: {
    id: "dev-user-001",
    name: "Dev Trader (Admin)",
    email: "dev@gorengan.internal",
    image: null,
  },
  expires: "2099-12-31T23:59:59.999Z",
};

function SessionErrorHandler({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    // If Google refresh token failed or expired, prompt sign-in again (only if not bypassed)
    if (!isDevAuthBypass && session?.error === "RefreshAccessTokenError") {
      signIn("google");
    }
  }, [session]);

  return <>{children}</>;
}

function DevSessionBypassWrapper({ children }: { children: React.ReactNode }) {
  const realSession = useSession();

  const sessionValue = useMemo(() => {
    if (realSession.status === "authenticated" && realSession.data) {
      return realSession;
    }

    if (isDevAuthBypass) {
      return {
        data: DEV_MOCK_SESSION,
        status: "authenticated" as const,
        update: async () => DEV_MOCK_SESSION,
      };
    }

    return realSession;
  }, [realSession]);

  return (
    <SessionContext.Provider value={sessionValue}>
      {children}
    </SessionContext.Provider>
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <DevSessionBypassWrapper>
        <SessionErrorHandler>{children}</SessionErrorHandler>
      </DevSessionBypassWrapper>
    </NextAuthSessionProvider>
  );
}
