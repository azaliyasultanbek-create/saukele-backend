FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl libc6-compat

# --- deps ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# --- prisma build ---
FROM base AS prisma-builder
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY package.json ./

RUN npx prisma generate

# УДАЛЯЕМ ТОЛЬКО dev deps аккуратно
RUN npm prune --omit=dev

# --- runner ---
FROM base AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

COPY --from=prisma-builder /app/node_modules ./node_modules
COPY --from=prisma-builder /app/prisma ./prisma
COPY . .

RUN chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 3000

CMD ["node", "src/server.js"]