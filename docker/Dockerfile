# Imagen única (ZimaOS / cualquier Docker): API Node + Next.js, supervisados con
# supervisord. La base de datos es SQLite, un único fichero en /data.
#
# Solo Next es público (puerto 3000). La API escucha en 127.0.0.1:3001 dentro del
# contenedor y Next le pasa /api/* (rewrite en frontend/next.config.ts).
#
# El repo es un monorepo de workspaces npm con un único lockfile, así que se
# construye todo junto y luego se copian a la imagen final solo los resultados.

# ---- Stage 1: build (motor, frontend standalone y backend compilado) ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY frontend/package.json frontend/
COPY backend/package.json backend/
# Sin scripts: el postinstall compila el motor y aún no está su código.
RUN npm ci --ignore-scripts
COPY . .
# El commit, para que una app abierta note que hay versión nueva.
ARG BUILD_ID=docker
ENV BUILD_ID=$BUILD_ID NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @bwf/engine \
    && npm run build -w @bwf/frontend \
    && npm run build -w @bwf/backend

# ---- Stage 2: dependencias de producción de la API ----
FROM node:24-bookworm-slim AS backend-deps
# Por si better-sqlite3 no tiene binario precompilado para la arquitectura.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --omit=dev --workspace=@bwf/backend --ignore-scripts \
    && npm rebuild better-sqlite3

# ---- Stage 3: runtime ----
FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends supervisor curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/blackjack.db \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# API: dependencias de producción, el motor compartido y el backend compilado.
COPY --from=backend-deps /app/node_modules ./node_modules
COPY --from=build /app/packages/engine/package.json ./packages/engine/
COPY --from=build /app/packages/engine/dist ./packages/engine/dist
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/drizzle ./backend/drizzle

# Next.js en modo standalone (trae sus propios node_modules).
COPY --from=build /app/frontend/.next/standalone ./web
COPY --from=build /app/frontend/.next/static ./web/frontend/.next/static
COPY --from=build /app/frontend/public ./web/frontend/public

COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/supervisord.conf /etc/supervisor/conf.d/blackjack.conf
RUN chmod +x /entrypoint.sh

VOLUME ["/data"]
EXPOSE 3000

# Pasa por Next y llega a la API, que hace un SELECT 1: comprueba las dos cosas.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fs "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
