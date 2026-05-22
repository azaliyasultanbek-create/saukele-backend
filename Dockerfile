FROM node:20-slim AS base

WORKDIR /app

# Устанавливаем необходимые системные зависимости для bcrypt (native module)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# --- Стадия установки зависимостей ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# --- Стадия сборки Prisma ---
FROM base AS prisma-builder
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY package.json ./
RUN npx prisma generate

# --- Стадия продакшн образа ---
FROM base AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Копируем зависимости и сгенерированный Prisma клиент
COPY --from=prisma-builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=prisma-builder --chown=nodeuser:nodejs /app/prisma ./prisma

# Копируем исходный код
COPY --chown=nodeuser:nodejs . .

USER nodeuser

EXPOSE 3000

# Запуск по умолчанию — сам сервер (можно переопределить на worker'ы через CMD)
CMD ["node", "src/server.js"]
