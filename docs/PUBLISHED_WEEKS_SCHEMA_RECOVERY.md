# Recuperación del esquema `published_weeks` (pendiente)

## Contexto

Producción tiene la tabla `published_weeks`. El repositorio solo incluye:

- `20260403120000_published_weeks_edit_history.sql` — `ALTER TABLE published_weeks ADD COLUMN edit_history`
- FKs en `method_rules`, `pe2_weeks`, `assistant_week_context`, etc.

**No existe** en el repo la migración original `CREATE TABLE published_weeks`.

Sin el esquema real, el entorno Supabase local no puede aplicar el historial completo de
migraciones de forma fiel a producción.

## Restricciones (obligatorias)

- **Solo lectura** sobre producción.
- **Sin copiar datos** (filas, JSON de semanas, feedback, PII).
- **Sin modificar** producción (no DDL, no DML).
- **Sin** `db pull` completo que traiga datos.
- **Sin** guardar service_role, JWT ni dumps en Git.

## Procedimiento propuesto (siguiente fase — no ejecutado aún)

1. Obtener **solo metadatos** de la tabla en producción, por ejemplo:
   - `information_schema.columns` + `pg_constraint` + `pg_indexes` + políticas RLS
   - vía SQL Editor de solo lectura, o script con credencial de lectura acotada
2. Redactar migración local `CREATE TABLE published_weeks (...)` fiel al esquema real.
3. Revisión humana comparando columnas usadas por la app (`published_weeks.data`, `titulo`, etc.).
4. Añadir al repo **solo DDL**, nunca seed de producción.
5. Entonces permitir `supabase db reset` local.

## Qué no hacer

- Tabla stub mínima con solo `id uuid` (oculta diferencias).
- `pg_dump` de datos completos.
- Enlazar worktree a producción con `supabase link`.

## Estado

**Pendiente de ejecución** — esperando aprobación del procedimiento de lectura.
