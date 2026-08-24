# Auditoría posterior · Fase 2.3

**Fecha:** 5 de agosto de 2026

**Rama:** `feature/equipo-evo-f2-3-secuencia-guiada`

**Preview validada:** `http://127.0.0.1:5173/?incorporaciones`

**Veredicto técnico de producto:** aprobado para revisión manual de Marian.

La corrección convierte cada declaración genérica en un trabajo verificable. El resumen ordena el recorrido; las pantallas de actividad contienen la información y las comprobaciones; el dominio decide si la evidencia es válida.

| Actividad | Objetivo real | Comportamiento corregido | Problema resuelto | Evidencia de finalización |
|---|---|---|---|---|
| Revisar relevo anterior | Asumir el turno con contexto | Pantalla con nota, incidencia activa, elemento, estado, responsable, plazo y siguiente acción | Ya no se certifica desde el resumen | Relevo abierto, dos contenidos revisados, entrenador, fecha y hora |
| Comprobar sistemas | Verificar que funcionan los sistemas necesarios | Ordenador, música, luces, climatización y dispositivos se resuelven por separado | Una incidencia nace desde el sistema afectado y no finaliza la actividad | Estado por sistema o excepción vinculada; evidencia `systems_check` |
| Revisar espacios | Garantizar sala, baños, limpieza, orden y material | Checklist propia con cinco estados y problema por elemento | Ya no existe una confirmación global sin recorrido | Estado por elemento o excepción vinculada; evidencia `spaces_check` |
| Revisar Programación | Preparar las clases con contexto real | Programación muestra horario, sala, entrenador, objetivo, bloques, material, adaptaciones y avisos de tres clases | La confirmación se realiza donde vive la información y no duplica WodBuster | Identificadores exactos de las tres clases; evidencia `programming_review` |
| Preparar la primera clase | Dejar lista sesión, sala y alternativa | Pantalla con objetivo, personas, pasos, material y alternativa, seguida de cuatro comprobaciones | Ya no puede declararse preparada sin contexto | Cuatro resultados; evidencia `first_class_preparation` |
| Cerrar o entregar | Entregar o cerrar en condiciones verificables | Cada bloque final abre sus comprobaciones específicas y admite incidencias vinculadas | El cierre deja de repetir el patrón decorativo | Evidencia tipada por material, espacios, relevo y sistemas; entrenador, fecha y hora |

## Problemas resueltos por gravedad

1. **Crítico:** apertura y cierre ya no aceptan finalización sin haber abierto la actividad ni evidencia tipada.
2. **Crítico:** el dominio rechaza tipos incorrectos, listas incompletas y comprobaciones pendientes.
3. **Alto:** Programación forma parte de la revisión y conserva el contenido de clase fuera de Operativa.
4. **Alto:** cada incidencia de checklist queda vinculada al elemento afectado.
5. **Medio:** la auditoría conserva resultados por comprobación, responsable, fecha y hora.
6. **Medio · accesibilidad:** los diálogos reciben foco, exponen su rol modal, se cierran con `Escape` y restauran el foco cuando procede.

## Evidencia manual posterior

- Escritorio `1440 × 1000`: recorrido completo desde reinicio hasta entrega, recarga persistente y excepción de Música visible para Dirección.
- Móvil `390 × 844`: actividad específica, navegación, objetivos táctiles, lectura sin desbordamiento y cierre bloqueado con lista concreta.
- La excepción se guardó con `Dirección Demo`, plazo `2026-08-05T16:00` y siguiente acción.
- El botón final permaneció desactivado hasta completar primera clase y las cuatro actividades finales.
- La recarga recuperó el turno cerrado al 100 % y la vista de Dirección omitió la rutina.
- Teclado: el diálogo recibió foco y `Escape` lo cerró correctamente.

## Comprobaciones automáticas

```text
npm run test -- src/domain/shift/shiftDomain.test.js src/adapters/shift/localShiftRepository.test.js src/IncorporacionesApp.interface.test.jsx → 20/20
npm run test → 336/336
npm run build → correcto
```

El aviso de Vite sobre chunks superiores a 500 kB y el aviso local de variables Supabase ausentes son preexistentes y no afectan al sandbox de Fase 2.3.
