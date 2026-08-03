# PLAN.md
## Plan refinado · Programming EVO

**Estado:** documento vivo · arquitectura corregida · Fase 1 pendiente de nueva aprobación visual
**Repositorio:** `marianpersonaltrainer-oss/programing`
**Rama de preparación:** `feature/equipo-evo-f1-visual`
**Código autorizado:** no, hasta aprobar el siguiente ajuste visual
**Fase activa:** Fase 1 · Arquitectura visual integrada en Programming EVO

---

## 1. Propósito

Este plan convierte `PRD.md` en fases pequeñas, comprobables y reversibles.

Cada fase debe terminar en algo que Marian pueda probar en pantalla.

No se avanza porque “el código está terminado”. Se avanza cuando la prueba principal funciona y Dirección decide:

- `Aprobada`;
- `Ajustar`;
- `Pausar`.

---

## 2. Reglas obligatorias

1. La Fase 1 es exclusivamente visual, local y móvil primero.
2. Solo usa datos ficticios y fijos.
3. No usa base de datos, login real, permisos reales, integraciones ni datos de clientes reales.
4. No se conecta WodBuster en las primeras fases.
5. No se modifica producción sin aprobación expresa.
6. Programming puede ser superficie de lectura, no propietario del expediente operativo.
7. Cada fase tiene una sola funcionalidad principal.
8. No se amplía alcance sin actualizar `PRD.md` y `PLAN.md`.
9. Cada regla de estado que se implemente más adelante debe tener al menos una prueba automatizada.
10. Ninguna fase se cierra sin prueba principal en pantalla.
11. El producto único es **Programming EVO**; no se crea otra aplicación, login o navegación independiente.
12. El entrenador tendrá dos áreas principales: `Programación` y `Mi turno`.
13. `?incorporaciones` es únicamente un sandbox temporal local de Fase 1; no define la arquitectura ni la ruta final de producción.
14. El sandbox puede evaluarse antes de la puerta general de Supabase para funcionar sin credenciales reales.
15. `?v2` no se reutiliza ni se modifica.

---

## 3. Estado actual del repositorio

La aplicación existente usa:

- React 18;
- Vite 5;
- Tailwind CSS;
- Supabase;
- Vitest;
- funciones desplegadas en Vercel.

Scripts disponibles:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test`
- `npm run test:ci`
- `npm run test:prompts`
- `npm run test:method`
- `npm run test:evo-rules`

Modos existentes:

- aplicación principal de programación;
- vista coach con `?coach`;
- vista `?v2`.

Existe un prototipo local en `?incorporaciones`. Su arquitectura anterior no está aprobada y debe considerarse material de sandbox, no una aplicación ni una propuesta de navegación final.

---

## 4. Resumen de fases

| Fase | Resultado visible | Datos | Integraciones |
|---|---|---|---|
| 1 | Esqueleto visual navegable | Ficticios y fijos | Ninguna |
| 2 | Flujo completo simulado | Mock data | Ninguna |
| 3 | Persistencia y acceso interno | Base propia | Ninguna externa |
| 4 | Flujo real con activación manual | Piloto | Manual |
| 5 | Avisos y bucle de retorno | Piloto | Calendar/email básico |
| 6 | Vista de Dirección e informe semanal | Piloto | Ninguna nueva |
| 7 | Piloto real de 4 semanas | Nuevas incorporaciones | WodBuster manual |
| 8 | Integración WodBuster | Reales | API/RestHook/lectura |
| 9 | Extensiones futuras | Según módulo | Portal, Calendly, etc. |

---

# Fase 1 · Arquitectura visual integrada en Programming EVO

## Objetivo

Validar que Programación y Mi turno conviven dentro del producto existente sin duplicar WodBuster, antes de crear lógica, datos o integraciones.

## Qué se construye

Un prototipo local navegable con datos ficticios y estáticos.

La ruta `?incorporaciones` seguirá disponible únicamente como sandbox temporal local y podrá abrirse antes de la puerta general de Supabase. No representa la ruta final de producción y no reutiliza ni modifica `?v2`.

Navegación objetivo del Entrenador:

1. `Programación`;
2. `Mi turno`.

`Programación` conserva entrenamiento del día, notas, objetivo y estímulo, preparación de clase y feedback asociado a la sesión.

El segundo nivel de `Mi turno` contiene:

1. `Hoy`;
2. `Protocolos`;
3. `Mi evolución`.

`Hoy` muestra entrada y puntualidad, apertura o relevo, briefing especial, persona nueva, adaptación relevante, incidencia previa, tareas operativas críticas, registro de incidencia, feedback operativo, caja, sala/material, relevo y cierre. Solo aparece información de cliente cuando requiere una acción especial.

`Protocolos` contiene Apertura, Cierre, Caja, Primera clase, Incidencias, Feedback, Relevo, Seguimiento y Handbook. Cada protocolo puede abrirse desde la biblioteca y desde una tarea contextual.

`Mi evolución` representa la operativa diaria sin mezclarla con la evaluación de calidad de clase.

Navegación objetivo de Dirección:

1. `Programación`;
2. `Operativa`;
3. `Evaluaciones`;
4. `Equipo`.

`Operativa` concentra turnos, tareas, incidencias, feedbacks y relevos. `Evaluaciones` contiene observación de Dirección, observación mensual o Ghost Customer basada en el Handbook. Los criterios del Handbook no se convierten en tareas diarias.

WodBuster conserva alumnos, reservas, asistencia, horarios, pagos, tarifas y ficha general. El prototipo no duplicará listas completas de alumnos, reservas normales, asistencia ordinaria, pagos, tarifas ni información general disponible allí.

Se separan dos tipos de feedback:

- feedback de programación, asociado a la sesión dentro de `Programación`;
- feedback operativo o de cliente, gestionado en `Mi turno` para primera clase, incidencia, seguimiento o relevo.

Componentes:

- tarjetas de tarea;
- etiquetas de estado;
- botones;
- aviso previo ficticio;
- cierre ficticio con tres resultados;
- estados vacíos;
- mensajes de confirmación y error simulados.
- selector ficticio `Mañana / Tarde`;
- registro visual de incidencia;
- cierre o relevo visual del turno.

El briefing previo no incluye Padrino/Madrina: esa práctica sucede de forma intuitiva dentro de la clase y no es un dato operativo que consultar en esta superficie.

Diseño:

- móvil primero;
- estilo EVO;
- una acción principal por pantalla;
- navegación máxima de dos niveles;
- sin menús técnicos.

## Qué queda fuera

- base de datos;
- login real;
- permisos reales;
- Supabase para este módulo;
- datos reales;
- WodBuster;
- Calendar o email;
- APIs;
- webhooks;
- automatizaciones;
- KPI reales;
- backend;
- despliegue;
- producción.

Quedan además explícitamente protegidos y sin cambios durante esta fase:

- `supabase/**`;
- `api/**`;
- scripts de migración;
- `src/lib/supabase.js`;
- generación y publicación de semanas;
- variables de entorno;
- Vercel;
- caché;
- service worker;
- `/`;
- `?coach`;
- `?v2`;
- producción.

## Prueba principal de la Fase 1

**Funcionalidad:**
Recorrer visualmente Programming EVO y distinguir con claridad la preparación de clase, la operativa especial del turno y la información que permanece en WodBuster.

**Pasos:**

1. Abrir el sandbox temporal de Programming EVO.
2. Entrar en `Programación` y revisar entrenamiento, objetivo, estímulo y notas.
3. Registrar visualmente feedback asociado al entrenamiento.
4. Entrar en `Mi turno > Hoy` y revisar apertura o relevo y tareas críticas.
5. Abrir una persona nueva con acción especial y consultar el briefing mínimo.
6. Completar feedback operativo de primera clase.
7. Registrar visualmente una incidencia y completar cierre o relevo.
8. Abrir un protocolo desde una tarea contextual y desde la biblioteca.
9. Consultar `Mi evolución`.
10. Cambiar a Dirección y localizar la operativa excepcional y una evaluación de calidad.

**Resultado esperado:**

- el entrenador distingue Programación de Mi turno;
- Mi turno solo muestra acciones especiales y operativa no resuelta por WodBuster o Programación;
- no aparecen listados completos, reservas ordinarias, pagos, tarifas ni fichas generales de WodBuster;
- feedback de programación y feedback operativo aparecen separados;
- los protocolos se abren desde biblioteca y contexto;
- operativa diaria y calidad de clase aparecen separadas;
- Dirección ve excepciones y evaluaciones sin convertir el Handbook en tareas diarias;
- navegación máxima de dos niveles;
- datos ficticios;
- cero peticiones a Supabase o APIs.

## Señal para pasar

- Marian reconoce Programming EVO como un solo producto y una sola navegación;
- Programación conserva la preparación y el feedback de sesión;
- Mi turno no duplica la gestión ordinaria de WodBuster;
- protocolos y evolución operativa son accesibles en el segundo nivel;
- Dirección distingue Operativa de Evaluaciones;
- estructura y estilo aprobados.

---

# Fase 2 · Flujo simulado con mock data

## Objetivo

Validar reglas y estados sin base de datos.

## Qué se construye

Simulación local de:

- primer pago;
- alta iniciada;
- responsable asignado;
- ficha preparada;
- primera reserva;
- entrenador informado;
- primera asistencia;
- briefing;
- seguimiento;
- excepción;
- caso cerrado.

Casos negativos:

- pago devuelto;
- pagó y no reservó;
- cancelación;
- no-show;
- incidencia.

## Qué queda fuera

- persistencia real;
- login real;
- datos reales;
- integraciones;
- avisos reales;
- permisos de producción;
- KPI oficiales.

## Funcionalidad principal

> El caso cambia de estado correctamente y nunca queda sin responsable o siguiente paso.

## Cómo se prueba

1. Abrir una alta ficticia.
2. Marcar ficha preparada.
3. Simular reserva y asistencia.
4. Cerrar como incorporación validada.
5. Repetir con seguimiento.
6. Intentar cerrar sin responsable ni fecha.
7. Confirmar que el sistema lo impide.
8. Repetir con Dirección.
9. Probar cancelación, no-show y pago devuelto.

## Señal para pasar

- los tres resultados funcionan;
- no-show no cuenta como primera clase;
- pago devuelto cancela el flujo;
- pagó y no reservó crea acción;
- no hay cierres incompletos;
- Marian aprueba reglas y textos.

---

# Fase 3 · Persistencia y acceso interno

## Objetivo

Guardar el mínimo necesario para un piloto interno.

## Qué se construye

- modelo mínimo de datos;
- acceso interno;
- cargos persistentes;
- asignaciones temporales;
- registro de altas;
- tareas;
- resultados;
- historial básico;
- permisos por contexto.

## Qué queda fuera

- portal cliente;
- login de alumnos;
- WodBuster automático;
- Calendly;
- Camino anual;
- Ghost Customer;
- compensación;
- migración masiva;
- datos clínicos.

## Funcionalidad principal

> Dos cuentas distintas ven y editan solo lo que les corresponde.

## Cómo se prueba

1. Entrar como Entrenador A.
2. Ver solo su caso.
3. Intentar abrir un caso de Entrenador B.
4. Confirmar bloqueo.
5. Entrar como Dirección.
6. Ver ambos casos.
7. Reasignar una tarea.
8. Cerrar sesión y volver a entrar.
9. Confirmar persistencia.

## Señal para pasar

- login estable;
- permisos correctos;
- persistencia real;
- historial útil;
- pruebas automatizadas mínimas superadas.

---

# Fase 4 · Flujo real con activación manual

## Objetivo

Ejecutar el proceso sin depender todavía de WodBuster.

## Qué se construye

- alta manual;
- primer pago manual;
- asignación de responsable;
- ficha mínima;
- primera reserva manual;
- asistencia manual;
- briefing;
- casos negativos;
- incidencias;
- bandeja de pendientes.

## Qué queda fuera

- integración WodBuster;
- avisos complejos;
- Portal Cliente;
- Camino anual;
- Calendly;
- dashboard completo.

## Funcionalidad principal

> Una incorporación ficticia completa el proceso con datos persistentes, responsables y evidencias.

## Cómo se prueba

1. Crear alumno ficticio.
2. Registrar pago dos veces.
3. Confirmar que no duplica.
4. Asignar responsable.
5. Completar ficha.
6. Registrar reserva.
7. Asignar entrenador.
8. Registrar asistencia.
9. Completar briefing.
10. Repetir con no-show y pago devuelto.

## Señal para pasar

- cero duplicados;
- cero casos sin responsable;
- todas las reglas críticas tienen salida;
- flujo simple;
- tests de reglas superados.

---

# Fase 5 · Avisos y bucle de retorno

## Objetivo

Que el entrenador no busque la tarea y reciba valor antes y después.

## Qué se construye

- aviso previo;
- resumen útil;
- enlace de cierre;
- confirmación de cierre;
- confirmación de seguimiento;
- confirmación de recepción por Dirección;
- resumen semanal personal;
- canal inicial Calendar o email.

## Qué queda fuera

- WhatsApp automático;
- push nativo;
- agentes;
- priorización inteligente;
- WodBuster automático.

## Funcionalidad principal

> El entrenador recibe el briefing y sabe qué ocurrió después de cerrar.

## Cómo se prueba

1. Programar primera clase ficticia.
2. Confirmar recepción del aviso.
3. Abrir en móvil.
4. Ver objetivo, restricciones y preparación.
5. Cerrar como seguimiento.
6. Ver confirmación.
7. Ver tarea en resumen semanal.
8. Confirmar excepción en Dirección.

## Señal para pasar

- aviso fiable;
- sin recordatorio de Marian;
- cierre menor de dos minutos;
- resultado devuelto al entrenador;
- sin duplicados.

---

# Fase 6 · Dirección e informe semanal

## Objetivo

Supervisar sin revisar todo.

## Qué se construye

Bandeja de excepciones:

- alta sin responsable;
- ficha pendiente;
- entrenador no informado;
- briefing pendiente;
- seguimiento sin dueño;
- tarea vencida;
- incidencia abierta;
- recordatorio manual.

Informe semanal por persona.

## Qué queda fuera

- dashboard ejecutivo completo;
- retención anual;
- facturación;
- compensación;
- ranking;
- KPI subjetivos;
- Ghost Customer activo.

## Funcionalidad principal

> Marian identifica en menos de cinco minutos qué requiere atención y quién es responsable.

## Cómo se prueba

1. Crear cinco casos con estados distintos.
2. Abrir Dirección.
3. Identificar vencidos y sin responsable.
4. Abrir informe de entrenador.
5. Resolver una excepción.
6. Confirmar que desaparece.

## Señal para pasar

- solo excepciones;
- todas con dueño y siguiente paso;
- informe consistente;
- revisión semanal menor de diez minutos.

---

# Fase 7 · Piloto real de cuatro semanas

## Objetivo

Validar adopción, valor y carga.

## Qué se construye

No se añade alcance. Solo se estabiliza.

## Qué queda fuera

- nuevas funcionalidades;
- integración WodBuster;
- portal;
- Calendly;
- Camino anual;
- agentes;
- migración;
- compensación.

## Funcionalidad principal

> El equipo usa el flujo cuatro semanas sin rescate diario de Marian.

## Cómo se prueba

Medir:

- altas con responsable;
- fichas en plazo;
- briefings;
- casos sin dueño;
- seguimientos;
- incidencias;
- uso de la app;
- recordatorios de Marian;
- minutos de cierre.

## Señal para pasar

- 100 % primeras clases con briefing;
- 0 casos sin responsable;
- ≥90 % tareas críticas en plazo;
- 100 % incidencias graves escaladas;
- uso sostenido;
- reducción de interrupciones;
- beneficio percibido por el equipo.

---

# Fase 8 · Integración WodBuster

## Objetivo

Automatizar solo lo que el piloto demuestre repetitivo.

## Qué se construye

Primero, spike técnico:

- API;
- RestHooks;
- campos;
- límites;
- seguridad;
- reconciliación.

Después, solo si procede:

- primer pago;
- reserva;
- cancelación;
- no-show;
- asistencia.

Siempre debe existir entrada manual de respaldo.

## Qué queda fuera

- sustituir WodBuster;
- CRM;
- Portal Cliente;
- Calendly.

## Funcionalidad principal

> Un evento actualiza el caso correcto sin duplicarlo.

## Cómo se prueba

1. Enviar evento de staging.
2. Ver actualización.
3. Repetir evento.
4. Confirmar que no duplica.
5. Simular fallo.
6. Ver error.
7. Usar entrada manual.
8. Ejecutar reconciliación.

## Señal para pasar

- eventos fiables;
- cero duplicados;
- fallos visibles;
- reconciliación correcta;
- reducción de trabajo medida.

---

# Fase 9 · Extensiones futuras

Solo después de cerrar la V1:

- Camino EVO completo;
- revisiones e hitos;
- Marcador EVO;
- Portal Cliente;
- Ghost Customer;
- Leads y Calendly;
- agentes;
- panel económico;
- proyectos internos.

Cada extensión exige actualizar `PRD.md` y este `PLAN.md`.

---

## 5. Formato obligatorio de cierre de fase

# Prueba principal

**Funcionalidad:**
[una sola funcionalidad]

**Pasos:**

1. …
2. …
3. …

**Resultado esperado:**
[qué debe verse]

**Resultado real:**
[qué ocurrió]

**Incidencias:**
[errores]

**Decisión de Dirección:**
`Aprobada` / `Ajustar` / `Pausar`

**Cambio en PRD.md:**
`No` / `Sí: sección…`

**Cambio en PLAN.md:**
`No` / `Sí: fase…`

---

## 6. Estado actual

- `PRD.md` existe.
- `PLAN.md` existe.
- `AGENTS.md` existe.
- Fase activa: Fase 1 · Arquitectura visual integrada en Programming EVO.
- Fase 1: arquitectura documentada y pendiente de nueva aprobación visual de Marian.
- Trabajo autorizado actual: actualización documental exclusivamente.
- Código autorizado: no, hasta recibir aprobación para reorganizar el prototipo.
- Código modificado: sí, exclusivamente prototipo visual de Fase 1.
- Producción modificada: no.
- Condición para iniciar Fase 1: cumplida.
