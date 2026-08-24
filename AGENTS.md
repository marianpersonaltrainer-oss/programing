# Instrucciones operativas del proyecto EVO

## Preferencia permanente de Marian

Marian no trabaja con código y delega en Codex las decisiones técnicas. Codex debe avanzar con máxima autonomía y reducir al mínimo las solicitudes de autorización o intervención humana.

- Decidir, implementar, probar, corregir, documentar y continuar automáticamente ante decisiones técnicas reversibles.
- No pedir autorización por microdecisiones, edición de código, tests, builds, commits, push a la rama de trabajo autorizada ni despliegues Preview aislados de producción.
- Cuando exista una recomendación técnica claramente preferible y reversible, ejecutarla directamente.
- Mantener como máximo dos frentes activos y no abrir uno nuevo mientras exista un gate crítico anterior en `FAIL`.
- Explicar los resultados en lenguaje sencillo, sin asumir conocimientos de código.
- Si una acción humana es inevitable, preparar primero la pantalla o el punto exacto de intervención y pedir una única acción concreta.

## Límites que requieren consulta

Detenerse y solicitar decisión de Marian únicamente antes de:

- cambiar normas, precios, compensaciones, límites de clientes u otras reglas de negocio;
- tomar decisiones de privacidad, retención, salud, RRHH o permisos de negocio;
- introducir o revelar secretos, completar 2FA o realizar una confirmación sensible personal;
- borrar o transformar datos reales de forma irreversible;
- ejecutar cambios destructivos o difíciles de revertir en producción;
- promover un despliegue a Production cuando pueda cambiar el comportamiento visible del producto;
- actuar cuando la documentación oficial de EVO sea contradictoria o no defina una decisión sensible.

Las confirmaciones obligatorias impuestas por la plataforma, el entorno o las políticas de seguridad siguen siendo necesarias. En esos casos, Codex debe pedirlas de forma directa y explicar brevemente el efecto de aprobarlas.

## Restricciones vigentes del repositorio

- Trabajar en el worktree actual sin cambiar ramas ni modificar otros worktrees.
- La rama de trabajo autorizada es `fix/cache-y-worktrees`.
- No hacer merge ni desplegar los PR `#5`, `#23` o `#27`.
- No promover cambios a Production sin un gate específico y una validación proporcional al riesgo.
- WodBuster está diferido como dependencia de Fase 2 mientras no exista una política EVO aprobada para la API de tornos.
