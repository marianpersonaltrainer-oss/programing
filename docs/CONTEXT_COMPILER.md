# Context Compiler — Sprint 1

Módulo interno de servidor. **No hay endpoint público** `GET/POST /api/context-compiler`.

## Archivos

| Archivo | Rol |
|---------|-----|
| `api/lib/contextCompiler.js` | Lógica pura de selección y conflictos |
| `api/lib/loadMethodRules.js` | Carga desde Supabase (service role) |
| `api/lib/shadowCompilerLog.js` | Logs seguros en modo sombra |
| `api/lib/methodRuleConstants.js` | Enums y constantes |
| `api/programming-week-briefing.js` | Invoca sombra si `CONTEXT_COMPILER_SHADOW_MODE` |

## Dimensiones (independientes)

| Dimensión | Columna | Valores |
|-----------|---------|---------|
| Estado | `rule_status` | legacy_unreviewed, pending_review, active, rejected, archived, superseded |
| Vigencia | `rule_validity` | permanent, temporary, weekly_exception |
| Fuerza | `rule_strength` | required, preferred, avoid, prohibited |
| Origen | `rule_origin` | manual, correction, system_prompt, method_panel, migrated, coach_feedback |
| Tema | `rule_key` | warmup_visibility, landmine_frequency, … |

## Orden de prioridad (con ejemplos)

1. **Elegibilidad:** solo `rule_status = active` con `rule_key` definido.
2. **Exclusiones:** legacy_unreviewed, pending_review, rejected, archived y superseded. Una regla solo sustituye mediante `supersedes_id` mientras la nueva regla también sea elegible para el contexto y esté vigente.
3. **Agrupación:** por `rule_key` (no por `rule_type` ni texto libre).
4. **Vigencia:** `weekly_exception` > `temporary` (en rango) > `permanent`.
5. **Especificidad:** franja > sala > clase > día > semana > mesociclo > temporada > org.
6. **Fuerza:** prohibited (4) > required (3) > avoid (2) > preferred (1).
7. **Conflicto:** mismo `rule_key`, misma especificidad, fuerzas incompatibles (required↔prohibited, required↔avoid) → ninguna entra al prompt.

Si falta `org`, temporada o mesociclo en el contexto, las reglas acotadas a ese
campo se excluyen de forma segura. Una regla temporal o semanal con fechas tampoco
se aplica si la fecha objetivo no está disponible.

### Ejemplo A — preferencia vs prohibición

- Global `landmine_frequency` + preferred: "opcional"
- Semana 3 + prohibited: "no landmine"

→ Gana **prohibited** (mayor fuerza). Sin conflicto.

### Ejemplo B — excepción semanal

- Permanent required: "calentamiento obligatorio"
- weekly_exception semana 3: preferred "sin bloque calentamiento"

→ Gana **weekly_exception** (tier de vigencia superior).

### Ejemplo C — conflicto

- Active required: "calentamiento obligatorio"
- Active prohibited: "sin calentamiento"

→ Misma especificidad → **conflict**; prompt compacto excluye ambas.

## Modo sombra

Variable de **servidor** (no VITE):

```bash
CONTEXT_COMPILER_SHADOW_MODE=true
```

- No altera `contextPack` ni respuesta HTTP.
- Logs: ids, `rule_key` y métricas; no incluyen previews del texto.
- No escribe textos completos ni parciales del método.

## Reglas legacy (53 filas)

Tras aplicar `20260720140000_method_rules_scope.sql`:

```sql
UPDATE method_rules SET rule_status = 'legacy_unreviewed', … WHERE rule_status IS NULL;
```

El compilador las **excluye** hasta revisión manual y `rule_status = active` + `rule_key` asignado.

Procedimiento de clasificación (humano, post-migración):

1. Exportar filas legacy (solo metadatos + preview).
2. Asignar `rule_key` y dimensiones.
3. Promover a `pending_review` → revisión Marian → `active` o `rejected`.
4. Nunca promoción masiva automática a permanent/active.

## Seguridad

- Compilador: solo server-side, service role, sin endpoint público.
- `POST /api/method-rule`: modo legacy (riesgo documentado) vs `METHOD_RULE_SECURE_MODE` (JWT V2).
- Origin allowlist **no** sustituye autenticación.

## Rollback

1. `CONTEXT_COMPILER_SHADOW_MODE=false`
2. `METHOD_RULE_SECURE_MODE=false`
3. Código anterior sigue usando columnas legacy (`active`, `source`).
4. Migración aditiva: columnas nullable ignorables.

## Prueba local de migración (PGLite)

```bash
npm run test:migration:rules
```

- Entorno **in-memory** con `@electric-sql/pglite`; sin credenciales ni red.
- Valida esquema, backfill `legacy_unreviewed` (53 filas simuladas), `pending_review`,
  rechazo de inserts inválidos y exclusión en el Context Compiler.
- **No valida RLS** (políticas `service_role`/`authenticated` requieren Supabase real).

## RLS (preparado, no aplicado en Sprint 1)

Sprint posterior: reemplazar `method_rules_select_auth_service` por filtro `org_id = pe2_my_org()` y denegar `anon`.
