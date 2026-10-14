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
- La base de datos se define en `supabase/migrations/`: ejecuta cada archivo nuevo en el SQL Editor de Supabase.

## Despliegue en Vercel (dos proyectos del mismo repo)

1. **Backend:** Add New → Project → este repo → *Root Directory* `backend`, nombre `blackjackwithfriends-backend`.
   Environment Variables: `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (la clave secreta de Supabase, pégala solo ahí).
2. **Frontend:** otro proyecto con el mismo repo → *Root Directory* `frontend` (preset Next.js).
   Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (los antiguos `VITE_SUPABASE_*` también valen).
3. Si el backend no quedó en `blackjackwithfriends-backend.vercel.app`, define `API_ORIGIN` en el proyecto del frontend con su URL.

Cada push a `main` despliega los dos proyectos.
