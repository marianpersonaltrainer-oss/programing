# Auditoría previa · Fase 2.3

**Fecha:** 5 de agosto de 2026

**Rama y commit visibles:** `feature/equipo-evo-f2-3-secuencia-guiada` · `1d39027a081303ef9342a7e913b91779fd7e7f2f`

**Preview:** `http://127.0.0.1:5173/?incorporaciones`

**Veredicto previo:** no aprobado.

La preview se recargó antes de la prueba y mostró `Fase 2.3 · Local`, coherente con la rama y el commit remotos. El código no registra un service worker y la recarga recuperó el estado desde el adaptador local, no desde una pantalla antigua almacenada en caché.

| Actividad | Objetivo real | Comportamiento actual | Problema | Comportamiento necesario | Evidencia de finalización |
|---|---|---|---|---|---|
| Revisar relevo anterior | Comprender pendientes antes de asumir la sala | Se completa desde el resumen con `Marcar completado` | No muestra nota, incidencias, responsable, plazo ni siguiente acción | Abrir una pantalla de relevo y confirmar después de revisar su contenido | Identificadores de nota e incidencias revisados, entrenador, fecha y hora |
| Comprobar sistemas | Asegurar que los sistemas necesarios funcionan | Un solo botón certifica ordenador, música, luces, aire y dispositivos | No existen comprobaciones individuales; una incidencia no queda ligada al elemento concreto | Abrir una checklist por sistema; comprobar o registrar una excepción trazada por elemento | Estado individual, incidencia vinculada cuando exista, entrenador, fecha y hora |
| Revisar espacios | Dejar sala, baños, limpieza, orden y material utilizables | Un solo botón completa toda la actividad | No se sabe qué espacio se revisó ni qué problema se encontró | Abrir una checklist de cinco comprobaciones y mantener pendiente cualquier problema sin trazar | Estado individual o excepción asignada, entrenador, fecha y hora |
| Revisar Programación | Comprender clases, objetivos, estructura, material, adaptaciones y avisos | El resumen de Mi turno se puede confirmar sin entrar en Programación | Duplica parte del horario y no demuestra que se revisó el contenido de clase | Abrir Programación, recorrer cada clase y confirmar allí la revisión | Clases revisadas por identificador, entrenador, fecha y hora |
| Preparar la primera clase | Dejar lista la primera sesión y su alternativa | Se completa desde el resumen sin contexto de preparación | No muestra objetivo, estructura, material, personas, pasos o alternativa | Abrir una pantalla de preparación y comprobar contexto, material, montaje y alternativa | Comprobaciones específicas, entrenador, fecha y hora |
| Cerrar o entregar | Dejar centro o relevo en condiciones verificables | Cuatro botones `Marcar revisado` completan comprobaciones compuestas | El cierre repite el mismo patrón decorativo de la apertura | Abrir cada comprobación final, completar sus puntos y permitir incidencias vinculadas | Comprobaciones finales específicas o excepción asignada, entrenador, fecha y hora |

## Hallazgos por gravedad

1. **Crítico:** el dominio acepta `completeOpeningItem` sin ninguna evidencia; cualquier cliente puede certificar una actividad compuesta con `itemId`, actor y hora.
2. **Crítico:** el cierre repite el mismo problema mediante `completeClosingItem`.
3. **Alto:** Programación no participa en la revisión de apertura; el entrenador confirma desde Operativa sin revisar objetivo, estructura, material o adaptaciones.
4. **Alto:** las incidencias de apertura se vinculan a la actividad general, no al sistema o espacio afectado.
5. **Medio:** se guarda quién y cuándo, pero no qué se comprobó; la auditoría registra una declaración, no una evidencia.
6. **Medio · accesibilidad:** el foco visible existe en navegación y acciones principales, pero los diálogos no gestionan todavía retorno de foco ni cierre con Escape. La conformidad completa no puede afirmarse solo con capturas.

## Evidencia manual previa

- Escritorio `1440 × 1000`: inicio, apertura, preparación, trabajo, Programación, primera clase, cierre bloqueado, entrega, recarga y Dirección.
- Móvil `390 × 844`: inicio, apertura, preparación, primera clase, cierre bloqueado, entrega y recarga.
- Una incidencia de sistemas quedó visible para Dirección con responsable, plazo y siguiente acción.
- La apertura y el cierre pudieron completarse sin abrir una pantalla de trabajo ni realizar comprobaciones concretas.
