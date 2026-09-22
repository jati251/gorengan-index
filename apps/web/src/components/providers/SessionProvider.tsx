"use client";

import React, { useEffect } from "react";
import {
  SessionProvider as NextAuthSessionProvider,
  useSession,
  signIn,
} from "next-auth/react";

function SessionErrorHandler({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    // If Google refresh token failed or expired, prompt sign-in again
    if (session?.error === "RefreshAccessTokenError") {
      signIn("google");
    }
  }, [session]);

  return <>{children}</>;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SessionErrorHandler>{children}</SessionErrorHandler>
    </NextAuthSessionProvider>
  );
}
