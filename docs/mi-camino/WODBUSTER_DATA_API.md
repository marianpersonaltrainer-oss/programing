# WodBuster Data API → Nucleus EVO · Issue #16

## Estado

**Contrato funcional confirmado para V1.**

Soporte WodBuster confirmó que la primera fase puede resolverse con API de Datos usando:

- `Atletas` como maestro de personas;
- `CuantoEntrenan` para persona + sesión + reserva/cancelación + asistencia;
- `CuantoEnseñan` para sesión + coach;
- polling periódico + reconciliación histórica.

RestHooks quedan fuera del camino crítico de V1.

## Regla de arquitectura

Esta integración es infraestructura compartida:

`WodBuster → worker server-side → Nucleus EVO / Supabase`

No depende del frontend ni del despliegue de Programming EVO. Programming/EVO Coach y la app independiente Mi Camino EVO consumen datos normalizados desde Nucleus mediante vistas/RPC con RLS. Ninguna app cliente recibe la clave WodBuster ni la service role.

## Contrato funcional confirmado

### Atletas

Fuente de identidad externa de clientes. Se conserva el identificador WodBuster como clave de enlace.

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
- **no-show** = sesión finalizada + no cancelada + sin `FechaLecturaTorno`.

### CuantoEnseñan

Sesiones impartidas con fecha/hora, entrenamiento y coach. Se cruza con `CuantoEntrenan` por ID de sesión; si WodBuster no entrega ID en una respuesta concreta, el normalizador usa una clave estable de fecha + hora + entrenamiento.

La exposición de coach se calculará después contando únicamente sesiones con asistencia confirmada.

## Implementación de V1

Código compartido:

- `integrations/wodbuster/adapter.js`: transporte server-side;
- `integrations/wodbuster/normalize.js`: normalización e IDs estables;
- `integrations/wodbuster/reconcile.js`: upserts idempotentes;
- `integrations/wodbuster/freshness.js`: guard de datos desfasados;
- `integrations/wodbuster/recovery.js`: candidatos neutrales a seguimiento, sin decidir todavía Plan B;
- `scripts/sync-wodbuster.mjs`: worker independiente;
- `.github/workflows/wodbuster-reconciliation.yml`: ejecución en staging.

## Ventanas de reconciliación

Configurables, no hardcodeadas en producto:

- `frequent`: últimos 3 días;
- `daily`: últimos 45 días;
- `historical`: rango explícito `WODBUSTER_SYNC_FROM` → `WODBUSTER_SYNC_TO`.

El objetivo es que cambios tardíos/correcciones en WodBuster reparen Nucleus sin duplicar efectos.

## Seguridad

- Las claves WodBuster y Supabase service role son **solo servidor**.
- Prohibido cualquier `VITE_*` para secretos.
- Las credenciales visibles históricamente deben rotarse antes del primer live test con datos reales.
- Las tablas raw/mirror no son superficie de cliente; su lectura directa queda limitada a admin por RLS.
- Si la sincronización está stale/degraded, se suprimen acciones negativas automáticas hacia clientes.
- Nunca registrar credenciales en logs ni persistirlas en `raw`.

## Variables de staging

Configurar exclusivamente en el GitHub Environment `programing-evo-staging`:

- `WODBUSTER_DATA_ATLETAS_URL`
- `WODBUSTER_DATA_CUANTO_ENTRENAN_URL`
- `WODBUSTER_DATA_CUANTO_ENSENAN_URL`
- `WODBUSTER_DATA_ACCESS_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MC_ORG_ID`

Opcionales:

- `WODBUSTER_DATA_AUTH_HEADER` (default `API_ACCESS_KEY`)
- `WODBUSTER_DATA_TIMEOUT_MS` (default `15000`)
- `EVO_TIMEZONE` (default `Europe/Madrid`)

## Runbook de staging

1. Aplicar `20260809170000_mi_camino_wodbuster_data_sync.sql` solo en `programing-evo-staging`.
2. Ejecutar advisors de seguridad/performance y resolver cualquier error crítico propio de `mc_*`.
3. Rotar la credencial WodBuster expuesta históricamente.
4. Configurar los secretos del GitHub Environment de staging.
5. Ejecutar manualmente el workflow en modo `frequent`.
6. Verificar en Nucleus un caso real controlado de:
   `persona → sesión → reserva/estado → asistencia/no-show → coach`.
7. Repetir el mismo rango y confirmar idempotencia.
8. Corregir en WodBuster un dato de prueba permitido o ampliar la ventana y comprobar que reconciliación actualiza sin duplicar.
9. Confirmar `mc_sync_state.last_status = ok` y que el guard stale funciona si se fuerza un fallo controlado.
10. Solo después dejar habilitado el schedule de staging.

## Rollback

El worker puede detenerse deshabilitando el workflow sin tocar Programming EVO ni Mi Camino EVO.

La migración es aditiva. Si hubiese que retirar esta versión antes de lanzamiento:

1. deshabilitar workflow;
2. retirar secretos del environment;
3. conservar mirrors para auditoría hasta decidir su borrado;
4. no borrar datos automáticamente desde CI.

## Criterio de aceptación #16

En staging debe quedar demostrado:

`persona → sesión → reserva/cancelación/no-show/asistencia → coach`

más:

- reconciliación idempotente;
- recuperación de cambios posteriores;
- reserva nunca cuenta como asistencia;
- multi-coach no se pierde;
- datos stale no generan acciones negativas;
- cero secretos en navegador, repo o logs.

Hasta completar el live test controlado, #16 está **implementado pero no cerrado**.
