# Centro de revisión del método — Sprint 2

Pantalla V2 para convertir reglas legacy y correcciones pendientes en reglas
canónicas revisadas por Marian. No usa IA: la agrupación y las propuestas son
deterministas, por lo que no añade coste de tokens.

## Flujo

1. `GET /api/method-rules-review` exige JWT y rol `programmer`, `admin` o
   `head_coach`.
2. El servidor carga solo reglas de la organización. Las 53 reglas antiguas con
   `org_id = null` solo se incluyen si EVO es la única organización o coincide
   con `EVO_DEFAULT_ORG_ID`.
3. Las reglas se agrupan por `rule_key` o por coincidencias temáticas. Lo que no
   puede clasificarse queda sin clave y no puede aprobarse hasta que Marian la
   escriba.
4. **Guardar pendiente** crea/actualiza una regla `pending_review` con
   `active = false`. No resuelve ni activa sus fuentes.
5. **Aprobar y activar** requiere confirmación explícita. La función SQL activa
   una sola regla canónica y marca sus fuentes como `superseded`, en la misma
   transacción.
6. **Rechazar grupo** requiere una confirmación diferente y deja todas sus
   fuentes con `active = false` y `rule_status = rejected`.

## Seguridad

- La API nunca acepta `orgId` ni `reviewerId` del navegador: los obtiene del JWT
  y del perfil V2.
- El navegador nunca recibe `SUPABASE_SERVICE_ROLE_KEY`.
- La función `pe2_review_method_rule_group(jsonb)` solo concede ejecución a
  `service_role` y vuelve a validar perfil, rol y organización.
- Las reglas legacy sin organización solo pueden reclamarse cuando la API ha
  comprobado que EVO es la única organización o coincide con
  `EVO_DEFAULT_ORG_ID`; una segunda organización no puede adivinar sus ids.
- Máximo 100 fuentes por operación y solo estados `legacy_unreviewed` o
  `pending_review`.
- Una operación con una fuente inexistente, ajena o ya resuelta aborta completa.
- No existe aprobación masiva automática ni promoción por confianza.

## Migraciones

Orden requerido, siempre primero en staging o entorno autorizado:

1. `20260720140000_method_rules_scope.sql`
2. `20260720170000_method_rule_review_center.sql`

Si faltan, la pantalla muestra `migration_required` y no intenta escribir.

La prueba local sigue sin credenciales ni red:

```bash
npm run test:migration:rules
```

Valida las 53 legacy, `pending_review`, aprobación, rechazo y rollback atómico.
No valida RLS ni JWT reales; eso requiere un proyecto Supabase de staging.

## Rollback

1. No aplicar la segunda migración o revocar ejecución de la función.
2. Ocultar `Tu método` de `Pe2Sidebar` si fuese necesario.
3. Las reglas pendientes continúan excluidas del Context Compiler.
4. Ninguna migración elimina columnas ni datos legacy.

## Fuera de este sprint

- Aplicar migraciones en Supabase remoto.
- Activar el Context Compiler en generación real.
- Sustituir los prompts duplicados.
- Resolver el riesgo legacy de `POST /api/method-rule` mientras
  `METHOD_RULE_SECURE_MODE` esté desactivado.
