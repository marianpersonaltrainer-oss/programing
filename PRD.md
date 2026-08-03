# PRD.md
## Equipo EVO · Incorporaciones

**Estado:** documento vivo · pendiente de aprobación de Dirección
**Repositorio:** `marianpersonaltrainer-oss/programing`
**Rama de preparación:** `feature/equipo-evo-f1-visual`
**Código autorizado:** no
**Fase activa:** ninguna

---

## 1. Contexto del repositorio

Este repositorio contiene la aplicación existente **Programming EVO**, construida con React, Vite, Supabase y funciones desplegadas en Vercel.

La aplicación actual mantiene tres contextos principales:

- vista de programación;
- vista coach mediante `?coach`;
- evolución técnica en `?v2`.

El nuevo trabajo no sustituye ni redefine Programming EVO. Añade, si el piloto lo valida, una superficie de lectura y ejecución llamada **Equipo EVO · Incorporaciones**, cuya ruta oficial será `?incorporaciones`.

`?incorporaciones` será una entrada nueva e independiente. No reutilizará ni modificará `?v2`, y tampoco alterará `/` ni `?coach`.

Cuando se autorice su implementación, la detección de `?incorporaciones` deberá evaluarse antes de la puerta general de configuración de Supabase que existe en `src/App.jsx`. Así, el prototipo visual podrá abrirse en local sin credenciales reales. Esta decisión queda documentada, pero no implementada en el estado actual.

**Regla de separación:** Programming EVO puede mostrar al entrenador lo que necesita ver, pero no será propietario del expediente operativo, las tareas, las evidencias ni el historial del cliente.

---

## 2. Problema

Desde que una persona realiza su primer pago hasta que completa su primera clase:

- el alta puede depender de la memoria;
- no siempre queda claro quién es responsable;
- la ficha puede estar incompleta;
- el entrenador puede recibir tarde el contexto;
- la primera clase puede terminar sin briefing;
- un seguimiento puede quedar sin dueño;
- Marian puede terminar recordando o comprobando cada paso.

El intento anterior con formularios y Trello no generó adopción sostenida. El nuevo sistema debe evitar ser solo un lugar donde el equipo escribe información. Debe devolver valor inmediato al entrenador.

---

## 3. Objetivo

> Conseguir que cada incorporación complete el recorrido desde primer pago hasta primera clase cerrada con responsable, ficha mínima, entrenador informado, evidencia y siguiente paso, sin recordatorios manuales de Marian.

El sistema debe beneficiar simultáneamente a:

- **cliente:** empieza con claridad y acompañamiento;
- **entrenador:** llega preparado y sabe qué hacer;
- **Dirección:** ve excepciones y cumplimiento sin perseguir tareas.

---

## 4. Usuarios

### 4.1 Entrenador

Necesita:

- ver quién es nuevo antes de la clase;
- conocer objetivo y restricciones funcionales;
- preparar carga, scaling y acompañamiento;
- cerrar la primera clase en menos de dos minutos;
- recibir confirmación del resultado y siguiente responsable.

### 4.2 Responsable del alta

Necesita:

- registrar la incorporación;
- asegurar la ficha mínima;
- comprobar la primera reserva;
- informar al entrenador;
- mantener el caso con dueño hasta su cierre.

No será automáticamente Marian.

### 4.3 Responsable de seguimiento

Necesita:

- ver el motivo del caso;
- registrar acción, resultado y próxima fecha;
- cerrar o escalar.

### 4.4 Administración

Gestiona en WodBuster:

- pago;
- tarifa;
- reserva;
- asistencia;
- vigencia.

### 4.5 Dirección

Necesita ver:

- alta sin responsable;
- ficha pendiente;
- entrenador no informado;
- briefing pendiente;
- seguimiento sin dueño;
- tarea vencida;
- incidencia abierta;
- recordatorios que Marian tuvo que realizar.

Dirección no debe revisar toda la actividad rutinaria.

---

## 5. Cargos y asignaciones

Se distingue entre:

### Cargos persistentes

- Dirección;
- Entrenador;
- Administración.

### Asignaciones temporales

- responsable de esta alta;
- entrenador de esta primera clase;
- responsable de este seguimiento;
- responsable de esta incidencia.

Una persona puede tener varios cargos. Cada caso debe tener una asignación concreta y verificable.

---

## 6. Flujo funcional objetivo

1. Primer pago confirmado en WodBuster.
2. Alta operativa creada.
3. Responsable del alta asignado.
4. Ficha mínima preparada.
5. Primera reserva registrada.
6. Entrenador informado antes de la clase.
7. Primera asistencia real confirmada.
8. Briefing posterior completado.
9. Resultado:
   - incorporación validada;
   - necesita seguimiento;
   - necesita Dirección.
10. Siguiente acción y responsable asignados cuando corresponda.
11. Caso cerrado sin pendientes invisibles.

### Casos negativos obligatorios

- pago devuelto;
- pagó y no reservó;
- cancelación;
- no-show;
- incidencia.

---

## 7. Información mínima para el entrenador

El briefing previo solo mostrará lo necesario para actuar:

- nombre;
- hora y clase;
- objetivo principal;
- experiencia;
- restricciones funcionales;
- preparación recomendada;
- Padrino/Madrina cuando corresponda;
- enlace al protocolo aplicable.

No mostrará diagnósticos médicos detallados, datos económicos ni información ajena a la clase.

---

## 8. Ficha mínima de incorporación

Debe contener:

- objetivo principal;
- experiencia previa;
- disponibilidad;
- restricciones funcionales de entrenamiento;
- observaciones imprescindibles;
- contacto de emergencia cuando proceda;
- consentimiento necesario.

Ejemplos de restricciones funcionales:

- sin impacto;
- evitar flexión lumbar cargada;
- carga inicial conservadora;
- necesita supervisión adicional;
- evitar apoyo de muñeca;
- rango limitado sin dolor.

---

## 9. Bucle de retorno

El sistema no puede limitarse a pedir información.

| Acción del entrenador | Respuesta que debe recibir |
|---|---|
| Lee briefing | Sabe cómo preparar la clase |
| Cierra incorporación | Confirmación de caso cerrado |
| Abre seguimiento | Responsable y próxima fecha |
| Escala a Dirección | Confirmación de recepción |
| Registra incidencia | Estado y siguiente responsable |
| Completa tareas | Resumen semanal personal |

---

## 10. KPI del piloto

### Por persona

| KPI | Fórmula |
|---|---|
| Altas asumidas | Número de altas asignadas |
| Fichas en plazo | Fichas preparadas antes de la clase / fichas asignadas |
| Briefings en plazo | Briefings cerrados en el turno / primeras clases realizadas |
| Seguimientos bien abiertos | Casos con responsable, acción y fecha / seguimientos creados |
| Incidencias registradas | Incidencias registradas / incidencias conocidas |
| Tareas sin evidencia | Tareas cerradas sin evidencia válida |
| Recordatorios necesarios | Veces que Marian tuvo que intervenir |

### Globales

- 100 % de altas con responsable;
- 100 % de fichas preparadas;
- 100 % de entrenadores informados;
- 100 % de briefings cerrados;
- 0 casos sin dueño;
- 100 % de incidencias graves escaladas;
- reducción de interrupciones a Marian.

Los KPI del piloto no se vinculan a compensación, sanción ni ranking.

---

## 11. Uso del Handbook

El Handbook mantiene los criterios objetivos de calidad:

1. One to One inicial.
2. One to One final.
3. Padrino/Madrina cuando había alumno nuevo.
4. Uso del nombre al menos tres veces.
5. EFI por cada parte.
6. Regla del 2.
7. Cargas asignadas por el entrenador.
8. Puntualidad de inicio y final.

No se transformarán en una checklist obligatoria después de cada clase. Se reservarán para formación, observación por muestra y futuro Ghost Customer.

---

## 12. Alcance de la Fase 1

La Fase 1 está pendiente de aprobación. Si Dirección la autoriza, consistirá exclusivamente en un prototipo:

- visual;
- local;
- móvil primero;
- con datos completamente ficticios y fijos;
- sin base de datos;
- sin login real;
- sin permisos reales;
- sin integraciones;
- sin datos de clientes reales.

La ruta oficial del prototipo será `?incorporaciones`. Deberá resolverse antes de la puerta general de Supabase para no exigir credenciales, pero esta adaptación no está implementada ni autorizada todavía.

No se reutilizará ni modificará `?v2`.

### Superficie de lectura

Panel `HOY` dentro de Programming EVO con:

- primeras clases;
- restricciones funcionales;
- preparación;
- protocolo;
- pendientes propios.

### Escritura

Cierre breve de primera clase.

### Dirección

Bandeja de excepciones.

### Registro

El expediente operativo debe permanecer neutral y desacoplado de la interfaz de Programming.

### Superficies protegidas

Durante la Fase 1 no se modificarán `supabase/**`, `api/**`, los scripts de migración, `src/lib/supabase.js`, la generación o publicación de semanas, las variables de entorno, la configuración o despliegue de Vercel, la caché, el service worker, `/`, `?coach`, `?v2` ni producción.

---

## 13. Fuera de alcance

- Portal Cliente con login;
- Camino EVO completo automatizado;
- CRM y Calendly;
- integración automática con WodBuster antes del piloto;
- Ghost Customer activo;
- agentes de IA;
- finanzas;
- compensación;
- sanciones;
- migración masiva;
- diagnósticos clínicos;
- dashboard general;
- WhatsApp automatizado.

---

## 14. Requisitos no funcionales

### Seguridad y privacidad

- datos sintéticos en local y staging;
- secretos fuera del repositorio;
- mínimos privilegios;
- no exponer datos económicos al entrenador;
- no guardar diagnósticos en la superficie operativa;
- no usar producción sin aprobación expresa.

### Usabilidad

- móvil primero;
- español;
- una acción principal por pantalla;
- navegación de máximo dos niveles;
- cierre de primera clase en menos de dos minutos;
- información relevante en uno o dos clics.

### Portabilidad

- Programming muestra, pero no posee el expediente;
- datos exportables;
- reglas desacopladas de la interfaz;
- posibilidad de sustituir herramienta sin perder historial.

---

## 15. Criterio de éxito

La primera versión se considera útil cuando:

- el entrenador obtiene valor antes de la clase;
- todas las primeras clases quedan cerradas;
- no existen casos sin responsable;
- Marian identifica excepciones en menos de cinco minutos;
- disminuyen los recordatorios e interrupciones;
- el equipo usa el flujo sin rescate diario.

---

## 16. Estado actual

- `PRD.md` existe.
- `PLAN.md` existe.
- `AGENTS.md` existe.
- Fase 1 pendiente de aprobación.
- Código no autorizado.
- Fase activa: ninguna.
- Código modificado: no.
- Producción modificada: no.

---

## 17. Control de cambios

Toda modificación de objetivo, usuario, permiso, regla, KPI, integración o alcance exige actualizar primero `PRD.md` y después `PLAN.md`.
