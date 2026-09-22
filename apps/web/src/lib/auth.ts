import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  [key: string]: unknown;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in: capture access token, refresh token, and expiry
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          expiresAt: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
          refreshToken: account.refresh_token,
        };
      }

      // Return previous token if the access token has not expired yet
      const tokenExpiresAt =
        typeof token.expiresAt === "number" ? token.expiresAt : 0;
      if (tokenExpiresAt && Date.now() < tokenExpiresAt) {
        return token;
      }

      // If no refresh token is present, we cannot refresh
      const refreshToken =
        typeof token.refreshToken === "string" ? token.refreshToken : undefined;
      if (!refreshToken) {
        return token;
      }

      // Access token has expired, refresh with Google OAuth
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID ?? "",
            client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
          method: "POST",
        });

        const tokens = (await response.json()) as GoogleTokenResponse;

        if (!response.ok) {
          throw tokens;
        }

        return {
          ...token,
          accessToken: tokens.access_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          // Fall back to old refresh token if Google didn't issue a new one
          refreshToken: tokens.refresh_token ?? refreshToken,
        };
      } catch (error) {
        console.error("Error refreshing Google access token", error);
        return { ...token, error: "RefreshAccessTokenError" as const };
      }
    },
    async session({ session, token }) {
      if (session.user && typeof token.sub === "string") {
        session.user.id = token.sub;
      }
      if (token.error === "RefreshAccessTokenError") {
        session.error = "RefreshAccessTokenError";
      }
      return session;
    },
  },
});
