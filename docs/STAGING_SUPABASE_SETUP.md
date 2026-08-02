# Supabase local — ProgramingEvo (worktree)

Entorno **local** con `supabase start`. Sin enlace a producción.

## Referencia

| Entorno | Identificador |
|---------|---------------|
| **Producción** (no tocar) | ref `wxrqvcthrkabjllvqghq` |
| **Local** | `project_id = programingevo-staging-worktree` en `config.toml` |

## Estado

- [x] `npx supabase init` — genera `config.toml` + `.gitignore` (sin secretos embebidos)
- [ ] Docker (`docker info`)
- [ ] Esquema real `published_weeks` — ver `docs/PUBLISHED_WEEKS_SCHEMA_RECOVERY.md`
- [ ] `supabase start` + `db reset` local
- [ ] Pruebas RLS/JWT

## Pendiente crítico: `published_weeks`

El repo **no incluye** `CREATE TABLE published_weeks`. No usar stub simulado.
Recuperar esquema real por procedimiento **solo lectura** (sin datos personales).

## Prohibido

- `supabase link`, `db push`, `db pull`, `db dump` contra producción
- Credenciales de producción en Git
- Stub inventado de `published_weeks`

## Worktree

Ruta: `/Users/apple/Desktop/programingevo-staging-worktree`  
Rama: `staging/supabase-prep`

El repo principal `/Users/apple/Desktop/programingevo` no debe recibir link ni credenciales de staging.
