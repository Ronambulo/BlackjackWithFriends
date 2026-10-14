# Blackjack with Friends

Liga semanal de blackjack entre amigos, como PWA instalable en iOS y Android. Diseño completo en [docs/DISENO.md](docs/DISENO.md).

## Estructura

Monorepo con npm workspaces:

| Carpeta | Paquete | Qué es |
|---|---|---|
| `frontend/` | `@bwf/frontend` | PWA (Next.js 16 + React 19) |
| `backend/` | `@bwf/backend` | API en Node (`backend/server.ts`) con SQLite + Drizzle |
| `packages/engine/` | `@bwf/engine` | Motor de blackjack compartido (con tests) |
| `docker/` | — | Imagen única: API + Next bajo supervisord |

El frontend reenvía `/api/*` a la API (`rewrites` de `frontend/next.config.ts`), así que el navegador siempre habla con un único origen y no hay CORS.

## Desarrollo

```bash
npm install
npm run dev
```

- PWA en http://localhost:5173 y API en http://127.0.0.1:3001/api (por ejemplo `/api/health`).
- La base de datos es `backend/data/blackjack.db` (se crea sola; no se sube a GitHub). Para empezar de cero, para la API y borra `backend/data/`.
- `npm test` ejecuta los tests del motor; `npm run typecheck`, `npm run lint` y `npm run build` revisan todo.
- Variables locales opcionales en `backend/.env.local` (ver `backend/.env.example`). Nunca se suben a GitHub.

## Base de datos (SQLite + Drizzle)

- Las tablas se definen en `backend/lib/schema.ts`. Tras cambiarlo, `npm run db:generate -w @bwf/backend` crea la migración SQL en `backend/drizzle/`.
- La API aplica las migraciones pendientes al arrancar, en local y en el contenedor.
- `npm run db:studio -w @bwf/backend` abre un visor de la base de datos en el navegador.

El login es de Better Auth con usuario y contraseña (sin correos): las sesiones viven en nuestra base de datos y en una cookie del dominio de la app.

## Docker (ZimaOS)

Como FinanceMaster y Beergram: un contenedor todo en uno.

- Cada push a `main` construye la imagen para amd64 y arm64 y la sube a `ghcr.io/ronambulo/blackjackwithfriends` (`.github/workflows/docker.yml`). En las PR solo se construye, sin subirla.
- En ZimaOS se instala con [`docker-compose.yml`](docker-compose.yml) (importar como app personalizada). Los datos quedan en `/DATA/AppData/blackjackwithfriends`.
- Ajusta `BETTER_AUTH_URL` a la dirección desde la que se abre la app (y `BETTER_AUTH_TRUSTED_ORIGINS` si hay más de una). El secreto de las sesiones se genera solo la primera vez.
- Para instalarla como PWA en el móvil hace falta HTTPS: pon delante un proxy inverso o un túnel y usa esa URL en `BETTER_AUTH_URL`.
- Para construirla en local: `docker compose up --build` (abre http://localhost:3021).
- El paquete de GHCR nace privado: la primera vez, en GitHub → Packages → blackjackwithfriends → Package settings, hazlo público (o haz `docker login ghcr.io` en ZimaOS).
