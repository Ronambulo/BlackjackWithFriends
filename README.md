# Blackjack with Friends

Liga semanal de blackjack entre amigos, como PWA instalable en iOS y Android. Diseño completo en [docs/DISENO.md](docs/DISENO.md).

## Estructura

Monorepo con npm workspaces:

| Carpeta | Paquete | Qué es | En Vercel |
|---|---|---|---|
| `frontend/` | `@bwf/frontend` | PWA (Next.js 16 + React 19) | Proyecto 1 |
| `backend/` | `@bwf/backend` | API: Vercel Functions en `backend/api/` | Proyecto 2 |
| `packages/engine/` | `@bwf/engine` | Motor de blackjack compartido (con tests) | — (lo usan los dos) |

El frontend reenvía `/api/*` al backend (`rewrites` de `frontend/next.config.ts`, en local y en producción), así que el navegador siempre habla con un único dominio y no hay CORS.

## Desarrollo

```bash
npm install
npm run dev
```

- PWA en http://localhost:5173 y API en http://localhost:3001/api (por ejemplo `/api/health`).
- `npm test` ejecuta los tests del motor; `npm run typecheck`, `npm run lint` y `npm run build` revisan todo.
- Variables locales: `frontend/.env.local` y `backend/.env.local` (copia los `.env.example`). Nunca se suben a GitHub.
- Sin `RESEND_API_KEY` en `backend/.env.local`, el código de login no se envía: sale en la terminal de la API.

## Base de datos (Neon + Drizzle)

- Las tablas se definen en `backend/lib/schema.ts`. Tras cambiarlo, `npm run db:generate -w @bwf/backend` crea la migración SQL en `backend/drizzle/`.
- `npm run db:migrate -w @bwf/backend` aplica las migraciones pendientes a la base de datos de `DATABASE_URL` (en `backend/.env.local`).
- `npm run db:studio -w @bwf/backend` abre un visor de la base de datos en el navegador.

El login es de Better Auth con código por email (sin contraseñas): las sesiones viven en nuestra base de datos y en una cookie del dominio del frontend. Los emails salen por Resend.

## Despliegue en Vercel (dos proyectos del mismo repo)

1. **Backend:** Add New → Project → este repo → *Root Directory* `backend`, nombre `blackjackwithfriends-backend`.
   Environment Variables (ver `backend/.env.example`): `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (la URL del frontend), `RESEND_API_KEY` y `EMAIL_FROM`.
2. **Frontend:** otro proyecto con el mismo repo → *Root Directory* `frontend` (preset Next.js).
   No necesita variables: el login y los datos pasan por el backend.
3. Si el backend no quedó en `blackjackwithfriends-backend.vercel.app`, define `API_ORIGIN` en el proyecto del frontend con su URL.

Cada push a `main` despliega los dos proyectos.
