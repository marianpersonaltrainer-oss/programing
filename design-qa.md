# Design QA — Coach EVO

## Objetivo de comparación

- **Fuente visual seleccionada:** `/Users/apple/.codex/generated_images/01a06e24-3566-74a2-b97e-8f5536c7e367/exec-1f99d53f-1b51-4617-ad41-852d1e7451cc.png`
- **Implementación:** `https://programing-evo.vercel.app/?coach`
- **Estado objetivo:** sesión de coach iniciada, pestaña `Mi turno`, una clase abierta.
- **Viewport de referencia:** móvil 390 × 844 CSS px.

## Evidencia disponible

Se verificó en producción la pantalla de acceso el 2026-09-28: carga correctamente la nueva superficie clara EVO, la jerarquía de acceso y los campos de identidad. La captura fue realizada en la sesión de navegador de verificación y no se puede exportar a una ruta del repositorio.

No se inició sesión: una revisión visual del interior necesita una cuenta de coach real y no se usaron ni se solicitaron credenciales.

## Cambios aplicados

- Superficie móvil clara, con morado solo como orientación y amarillo para el siguiente paso.
- `Mi turno` convertido en una secuencia: día → qué toca ahora → clase → briefing → nota de turno.
- Sesiones en tarjetas legibles en lugar de bloques oscuros densos.
- `Feedback` renombrado a `Notas`, con lenguaje de turno y estados visibles.
- Cierre de prueba explicado como una nota tras la clase, con niveles `EVO Basics`, `EVO Intermedio` y `EVO Funcional`.
- Semana, perfil, lista de pruebas y asistente alineados con el mismo sistema claro, el logo oficial y la paleta EVO.

## Comprobaciones técnicas

- `npm test -- --run src/utils/trialCloseSummary.test.js api/coach-trial-close.test.js`: 6/6 correcto.
- `npm run build`: correcto.
- Producción Vercel: `dpl_GoR4gzDwgARaZeGyKvU67AgjoXDv`, estado `Ready`.

## Pendiente para cerrar QA

1. Capturar `Mi turno`, una sesión desplegada, `Notas` y una prueba desde una cuenta individual de coach en móvil.
2. Comparar esas cuatro vistas con la fuente seleccionada al mismo tamaño de pantalla.
3. Corregir cualquier hallazgo P0–P2 antes de cambiar este resultado.

final result: blocked
