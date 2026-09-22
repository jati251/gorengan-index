FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/market-server ./apps/market-server
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gorengan/shared build
RUN pnpm --filter @gorengan/market-server build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/market-server ./apps/market-server
RUN pnpm install --prod --frozen-lockfile

EXPOSE 9000
CMD ["node", "apps/market-server/dist/main.js"]
