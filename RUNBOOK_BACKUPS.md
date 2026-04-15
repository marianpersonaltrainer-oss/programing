# Runbook de Backups (ProgramingEvo)

## Qué se respalda y cada cuánto

- **Frecuencia:** diaria, a las **01:00 UTC** (03:00 Madrid en horario habitual).
- **Origen:** base de datos de Supabase del proyecto (dump SQL completo vía `pg_dump`).
- **Retención automática:** se conservan los **30 backups más recientes**.

## Dónde encontrar los backups

- Los backups se publican en **GitHub Releases** de este repositorio.
- Formato de release/tag: `backup-YYYY-MM-DD`.
- Archivo adjunto típico: `backup-YYYY-MM-DD.sql.gz`.

## Restaurar paso a paso

1. Ir a GitHub Releases y descargar el asset `backup-YYYY-MM-DD.sql.gz` deseado.
2. Descomprimir:
   ```bash
   gunzip backup-YYYY-MM-DD.sql.gz
   ```
   Obtendrás `backup-YYYY-MM-DD.sql`.
3. Preparar una base de datos destino vacía (Supabase nuevo o DB limpia).
4. Restaurar con `psql`:
   ```bash
   psql "postgresql://USER:PASSWORD@HOST:PORT/postgres?sslmode=require" -f backup-YYYY-MM-DD.sql
   ```
5. Verificar tablas clave (`published_weeks`, `coach_sessions`, `coach_messages`, etc.).

## Qué hacer si la base actual se corrompe

1. Crear un **proyecto nuevo** en Supabase.
2. En el proyecto nuevo, ir a **Settings → Database** y copiar el **Connection string URI**.
3. Descargar el último backup sano de GitHub Releases.
4. Descomprimir el archivo `.sql.gz`.
5. Restaurar con `psql` sobre la base vacía del proyecto nuevo.
6. Validar que la app responde con:
   - semana activa visible,
   - endpoints API operativos,
   - tablas de feedback y guía accesibles.
7. Actualizar variables de entorno en Vercel con las credenciales del nuevo proyecto:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (si aplica en backend/serverless).
8. Redeploy en Vercel y hacer smoke test completo.

## Contactos internos y tiempos esperados

- **Owner técnico / backend:** responsable de Supabase y restauración SQL.
- **Owner producto / operaciones:** validación funcional post-restauración.
- **Tiempo estimado de restauración técnica:** 20–45 min (según tamaño DB).
- **Tiempo total estimado con validación:** 45–90 min.

