# WodBuster Data API — contrato V1 y runbook

Estado: **API Datos confirmada por soporte; polling + reconciliación, sin RestHooks** (issue #16).

## Contrato oficial mapeado

La documentación técnica que acompaña a los accesos de la cuenta genera una URL para cada recurso. Esas URL completas se copian, sin modificarlas ni registrarlas en logs, en:

| Recurso oficial | Variable server-side | Uso |
|---|---|---|
| `Atletas` | `WODBUSTER_DATA_ATLETAS_URL` | maestro e identificador de persona |
| `CuantoEntrenan` | `WODBUSTER_DATA_CUANTO_ENTRENAN_URL` | reservas, cancelación, `BorradoFueraHora`, sesión y `FechaLecturaTorno` |
| `CuantoEnseñan` | `WODBUSTER_DATA_CUANTO_ENSENAN_URL` | sesión impartida y coach(s) |

Autenticación oficial: cabecera `API_ACCESS_KEY`, configurable mediante `WODBUSTER_DATA_AUTH_HEADER`, con el valor de `WODBUSTER_DATA_ACCESS_KEY`. Todos estos valores viven únicamente en Vercel/server. Las consultas por intervalo usan `FechaInicio=YYYY-MM-DD` y `FechaFin=YYYY-MM-DD`.

No se documenta una URL literal porque es una URL de acceso específica de la cuenta. Copiarla desde **WodBuster → API Datos → Documentación técnica/ver**, no construir ni adivinar rutas. La credencial mostrada históricamente debe rotarse antes del test live.

## Semántica determinista

- Reserva futura no cancelada: `reserved`; nunca es asistencia.
- Cancelación: `cancelled`; con `BorradoFueraHora`: `late_cancelled`.
- `FechaLecturaTorno` con valor: única señal de `attended`/asistencia confirmada (torno o check manual).
- Clase ya iniciada/finalizada, no cancelada y sin lectura: `no_show`.
- La clave de sesión oficial se usa cuando existe; el fallback compuesto fecha/hora/entrenamiento es estable y auditado.
- Una sesión puede tener varios coaches. `CuantoEnseñan` se conserva completo; la exposición futura solo contará asistencias confirmadas.

## Polling, idempotencia y salud

Vercel ejecuta la ventana reciente cada 30 minutos y una ventana mayor diaria. Su tamaño no está hardcodeado: `MC_WODBUSTER_FREQUENT_DAYS` y `MC_WODBUSTER_DAILY_DAYS`. Una reconstrucción histórica se lanza de forma controlada con `POST /api/mi-camino-wodbuster-sync`, Bearer `MC_SYNC_SECRET`, body `{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}`.

Los mirrors hacen upsert por `(org_id, external_id)` y los snapshots por hash estable. Un reintento corrige estados posteriores y no duplica reservas, asistencias ni efectos. `mc_sync_state` registra inicio, éxito/error, ventana y recuentos sin secretos.

Si el último éxito supera `MC_WODBUSTER_STALE_AFTER_MINUTES` o el sync falla, el estado es `stale/degraded`: se suprimen no-show, Plan B negativo y acciones de coach derivadas. El cliente solo puede recibir un aviso neutral de datos pendientes de actualizar; integración/sync es visible únicamente a admin.

## Plan B / recolocación

Después de cancelación, cancelación tardía o no-show se espera una ventana configurable (24 h por defecto). Una reserva o asistencia posterior dentro de ella significa recolocación y cancela el seguimiento. Si no hay recolocación y los datos están frescos, se crea el candidato; la asignación debe usar el coach con más sesiones cruzadas con **asistencias confirmadas**, nunca reservas.

## Staging: prueba controlada

1. Aplicar `20260809170000_mi_camino_wodbuster_data_sync.sql` a `programing-evo-staging` y ejecutar advisors de seguridad.
2. Rotar la clave expuesta; configurar únicamente variables server-side y `MC_ORG_ID` de staging.
3. Elegir persona/sesión de prueba autorizada. Ejecutar rango corto y comprobar persona → reserva → estado → asistencia/no-show → todos los coaches.
4. Cambiar/cancelar/check-in manual en WodBuster, repetir exactamente el rango y verificar que cambió la misma fila, sin crecer los IDs.
5. Forzar `last_completed_at` antiguo en staging y confirmar que `findRecoveryCandidates` devuelve cero acciones.
6. Guardar solo IDs opacos, recuentos y timestamps como evidencia; nunca nombres, email, payload o claves.

## Rollback

1. Desactivar los crons quitando `MC_SYNC_SECRET` (responderán 401) y retirar las tres URLs/clave.
2. Revertir el despliegue Vercel.
3. Los mirrors son reconstruibles. Si se requiere limpiar staging, borrar sus filas por `org_id`; no tocar tablas de negocio/producción.
4. La migración es aditiva. No hacer `DROP` en producción; retirar tabla/columnas solo en una migración posterior aprobada.
