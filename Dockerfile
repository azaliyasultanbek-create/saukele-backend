FROM node:20-alpine AS base

WORKDIR /app



# Устанавливаем системные зависимости, включая совместимость с OpenSSL для Prisma на Alpine (musl)
RUN apk add --no-cache python3 make g++ openssl libc6-compat openssl1.1-compat

# --- Стадия установки зависимостей ---
FROM base AS deps
COPY package.json package-lock.json* ./
# Ставим ВСЕ зависимости (включая devDependencies, так как они нужны для prisma generate)
RUN npm ci

# --- Стадия сборки Prisma ---
FROM base AS prisma-builder
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY package.json ./
# Явно указываем Prisma использовать движок для Alpine (musl)
ENV PRISMA_QUERY_ENGINE_BINARY=node_modules/.prisma/client/query-engine-linux-musl
ENV PRISMA_SCHEMA_ENGINE_BINARY=node_modules/.prisma/client/schema-engine-linux-musl
# Генерируем клиент Призмы
RUN npx prisma generate
# Чистим dev-зависимости, оставляя только продакшн, чтобы образ весил меньше
RUN npm prune --production

# --- Стадия продакшн образа ---
FROM base AS runner




RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Копируем зависимости и сгенерированный Prisma клиент с правильными правами
COPY --from=prisma-builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=prisma-builder --chown=nodeuser:nodejs /app/prisma ./prisma

# Копируем исходный код
COPY --chown=nodeuser:nodejs . .

# Принудительно даем движку призмы права на выполнение внутри контейнера
RUN chmod -R 755 /app/node_modules/.prisma

USER nodeuser

EXPOSE 3000

CMD ["node", "src/server.js"]