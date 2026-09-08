# WodBuster Data API → Nucleus EVO · Issue #16

## Estado

**Contrato funcional confirmado para V1. Endpoints/auth exactos pendientes de confirmación final de soporte.**

Soporte WodBuster confirmó que la primera fase puede resolverse con API de Datos usando:

- `Atletas` como maestro de personas;
- `CuantoEntrenan` para persona + sesión + reserva/cancelación + asistencia;
- `CuantoEnseñan` para sesión + coach;
- polling periódico + reconciliación histórica.

RestHooks quedan fuera del camino crítico de V1.

## Regla de arquitectura

Esta integración es infraestructura compartida:

`WodBuster → worker server-side → Nucleus EVO / Supabase`

No depende del frontend ni del despliegue de Programming EVO. Programming/EVO Coach y la app independiente Mi Camino EVO consumen datos normalizados desde Nucleus. Ninguna app cliente recibe credenciales WodBuster ni Supabase service role.

## Contrato funcional confirmado

### Atletas

Fuente de identidad externa de clientes. Se conserva el identificador WodBuster como clave de enlace.

`mc_people` recibe únicamente los campos normalizados necesarios. **Nunca** se guarda el payload bruto de `Atletas` en `mc_people.metadata`, porque esa tabla puede ser auto-legible por el cliente mediante RLS y el raw administrativo puede contener PII innecesaria.

### CuantoEntrenan

Detalle por persona y sesión dentro de un rango de fechas. Debe permitir derivar:

- fecha/hora y entrenamiento;
- reserva;
- cancelación y momento de cancelación;
- cancelación fuera de plazo (`BorradoFueraHora`);
- asistencia confirmada (`FechaLecturaTorno`);
- tarifa/tipo de reserva cuando esté disponible.

Reglas:

- **reserva ≠ asistencia**;
- **asistencia confirmada** = `FechaLecturaTorno` con valor;
- **no-show** = sesión finalizada + no cancelada + sin `FechaLecturaTorno`;
- fecha y hora separadas se combinan en `Europe/Madrid`, evitando clasificar como no-show una clase futura del mismo día.

### CuantoEnseñan

Sesiones impartidas con fecha/hora, entrenamiento y coach. Se cruza con `CuantoEntrenan` por ID de sesión; si WodBuster no entrega ID en una respuesta concreta, el normalizador usa una clave estable de fecha + hora + entrenamiento.

La exposición de coach se calculará después contando únicamente sesiones con asistencia confirmada. Las sesiones con más de un coach se conservan en el mirror `mc_wodbuster_coach_sessions`.

## Implementación de V1

Código compartido:

- `integrations/wodbuster/adapter.js`: transporte server-side;
- `integrations/wodbuster/normalize.js`: normalización, fechas/horas e IDs estables;
- `integrations/wodbuster/reconcile.js`: upserts idempotentes y corrección de cambios tardíos;
- `integrations/wodbuster/freshness.js`: guard de datos desfasados;
- `integrations/wodbuster/recovery.js`: candidatos neutrales a seguimiento, sin decidir Plan B;
- `scripts/sync-wodbuster.mjs`: worker independiente;
- `.github/workflows/wodbuster-reconciliation.yml`: ejecución controlada en staging.

## Reconciliación

Ventanas configurables, no hardcodeadas en producto:

- `frequent`: últimos 3 días;
- `daily`: últimos 45 días;
- `historical`: rango explícito `WODBUSTER_SYNC_FROM` → `WODBUSTER_SYNC_TO`.

Una corrección posterior de WodBuster debe reparar Nucleus sin duplicar efectos.

### Corrección de asistencia

`mc_wodbuster_attendance` mantiene un registro estable por reserva:

- `confirmed=true` → asistencia real y única señal válida para frecuencia/hitos;
- `confirmed=false` → no cuenta como asistencia;
- `attended_at` puede ser `null`.

Esto permite que una `FechaLecturaTorno` añadida o retirada posteriormente corrija el mismo registro en la siguiente reconciliación. Nunca se conserva una asistencia fantasma por haber sido confirmada erróneamente en una consulta anterior.

### Recolocación tras una semana complicada

El checkpoint de producto sigue siendo 24 h después de cancelación/cancelación tardía/no-show. Si al revisar existe una reserva válida futura, esa clase puede celebrarse varios días después: no se exige que el entrenamiento ocurra dentro de las primeras 24 h.

La decisión final sobre riesgo de frecuencia y Plan B pertenece a la capa de producto (#17), no a #16.

## Seguridad y minimización

- Credenciales WodBuster y Supabase service role: **solo servidor**.
- Prohibido cualquier secreto bajo `VITE_*`.
- Las credenciales visibles históricamente se rotan antes del primer live test.
- Raw de reservas/asistencia/coach queda fuera de la superficie cliente y con lectura directa restringida a admin.
- Raw de `Atletas` no se guarda en `mc_people`.
- El sync no sobrescribe `mc_people.metadata` de producto.
- Si la sincronización está stale/degraded, se suprimen acciones negativas automáticas.
- Nunca registrar credenciales en logs ni persistirlas en `raw`.

## Configuración de staging

El destino es exclusivamente el GitHub Environment `programing-evo-staging` y el Supabase staging.

Variables de transporte previstas por el adapter actual:

- `WODBUSTER_DATA_ATLETAS_URL`
- `WODBUSTER_DATA_CUANTO_ENTRENAN_URL`
- `WODBUSTER_DATA_CUANTO_ENSENAN_URL`
- credencial/autenticación WodBuster server-side
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MC_ORG_ID`
- `EVO_TIMEZONE=Europe/Madrid`

**Importante:** los nombres/modo exacto de autenticación WodBuster se consideran provisionales hasta recibir la confirmación solicitada a soporte. No configurar una credencial real contra una suposición de header/auth.

## Migraciones de #16

En una instalación nueva:

1. `20260809170000_mi_camino_wodbuster_data_sync.sql`
2. `20260809173000_wodbuster_security_hardening.sql`
3. `20260809180000_wodbuster_attendance_correction.sql`
4. `20260809181000_wodbuster_people_data_minimization.sql`

Staging ya tiene aplicados los cambios equivalentes. Producción no se ha tocado.

## Live test antes del merge

No es necesario fusionar #16 para ejecutar la prueba real.

El workflow acepta un evento `pull_request:labeled` y solo ejecuta el sync real cuando el PR recibe explícitamente la etiqueta:

`run-wodbuster-live`

Secuencia:

1. confirmar endpoints y auth oficiales;
2. rotar/crear una credencial WodBuster exclusiva para esta integración;
3. configurar únicamente los secretos del environment `programing-evo-staging`;
4. añadir `run-wodbuster-live` al PR #27;
5. ejecutar modo `frequent` contra staging;
6. verificar un caso real de `persona → sesión → reserva/estado → asistencia/no-show → coach`;
7. repetir el rango y confirmar idempotencia;
8. verificar una corrección posterior y confirmar que Nucleus se repara;
9. confirmar `mc_sync_state.last_status = ok` y freshness saludable;
10. retirar la etiqueta o mantener el workflow sin nuevas ejecuciones hasta la decisión de merge.

Así `main` y producción permanecen intactos durante el gate.

## Rollback

El worker puede detenerse sin tocar Programming EVO ni Mi Camino EVO.

Si hubiese que retirar esta versión antes de lanzamiento:

1. no fusionar/cerrar PR;
2. retirar secretos del environment de staging;
3. conservar mirrors de staging solo mientras sean útiles para auditoría;
4. no borrar datos automáticamente desde CI.

## Criterio de aceptación #16

En staging debe quedar demostrado:

`persona → sesión → reserva/cancelación/no-show/asistencia → coach`

más:

- reconciliación idempotente;
- recuperación de cambios posteriores, incluida retirada de una asistencia errónea;
- reserva nunca cuenta como asistencia;
- multi-coach no se pierde;
- una clase futura del mismo día no se convierte prematuramente en no-show;
- datos stale no generan acciones negativas;
- cero secretos en navegador, repo o logs;
- cero payload bruto de `Atletas` en una tabla auto-legible por cliente.

Hasta completar el live test controlado, #16 está **implementado pero no cerrado**.
