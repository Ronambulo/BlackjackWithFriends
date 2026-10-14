# Blackjack with Friends

Liga semanal de blackjack entre amigos, como PWA instalable en iOS y Android. Diseño completo en [docs/DISENO.md](docs/DISENO.md).

## Estructura

Monorepo con npm workspaces:

| Carpeta | Paquete | Qué es | En Vercel |
|---|---|---|---|
| `frontend/` | `@bwf/frontend` | PWA (React + Vite) | Proyecto 1 |
| `backend/` | `@bwf/backend` | API: Vercel Functions en `backend/api/` | Proyecto 2 |
| `packages/engine/` | `@bwf/engine` | Motor de blackjack compartido (con tests) | — (lo usan los dos) |

El frontend reenvía `/api/*` al backend (proxy de Vite en local, rewrite de `frontend/vercel.json` en producción), así que el navegador siempre habla con un único dominio y no hay CORS.

## Desarrollo

```bash
npm install
npm run dev
```

- PWA en http://localhost:5173 y API en http://localhost:3001/api (por ejemplo `/api/health`).
- `npm test` ejecuta los tests del motor; `npm run typecheck`, `npm run lint` y `npm run build` revisan todo.
- Variables locales: `frontend/.env.local` y `backend/.env.local` (copia los `.env.example`). Nunca se suben a GitHub.

## Despliegue en Vercel (dos proyectos del mismo repo)

1. **Backend:** Add New → Project → este repo → *Root Directory* `backend`, nombre `blackjackwithfriends-backend`.
   Environment Variables: `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (la clave secreta de Supabase, pégala solo ahí).
2. **Frontend:** otro proyecto con el mismo repo → *Root Directory* `frontend` (preset Vite).
   Environment Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Si el backend no quedó en `blackjackwithfriends-backend.vercel.app`, cambia esa URL en `frontend/vercel.json`.

Cada push a `main` despliega los dos proyectos.
