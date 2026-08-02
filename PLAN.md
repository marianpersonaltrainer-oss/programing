# PLAN.md
## Plan refinado · Equipo EVO · Incorporaciones

**Estado:** documento vivo · pendiente de aprobación de Dirección  
**Repositorio:** `marianpersonaltrainer-oss/programing`  
**Rama documental inicial:** `docs/evo-live-docs-v1`  
**Código autorizado:** no  
**Fase activa:** ninguna

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

1. La Fase 1 es solo visual.
2. Se trabaja primero en local.
3. No se usan datos reales en local ni staging.
4. No se conecta WodBuster en las primeras fases.
5. No se modifica producción sin aprobación expresa.
6. Programming puede ser superficie de lectura, no propietario del expediente operativo.
7. Cada fase tiene una sola funcionalidad principal.
8. No se amplía alcance sin actualizar `PRD.md` y `PLAN.md`.
9. Cada regla de estado que se implemente más adelante debe tener al menos una prueba automatizada.
10. Ninguna fase se cierra sin prueba principal en pantalla.

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

No existe todavía el módulo Equipo EVO · Incorporaciones.

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

# Fase 1 · Esqueleto visual local

## Objetivo

Validar estructura, navegación, jerarquía y estilo antes de crear lógica o datos.

## Qué se construye

Un prototipo local navegable con datos ficticios y estáticos.

Pantallas mínimas:

- entrada del módulo;
- `Hoy`;
- `Nuevas altas`;
- `Primera clase`;
- `Seguimientos`;
- `Incidencias`;
- `Excepciones`;
- vista básica de Dirección;
- cambio visual de contexto Entrenador / Dirección.

Componentes:

- tarjetas de tarea;
- etiquetas de estado;
- botones;
- aviso previo ficticio;
- cierre ficticio con tres resultados;
- estados vacíos;
- mensajes de confirmación y error simulados.

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

## Funcionalidad principal

> Recorrer visualmente una incorporación y entender dónde mirar, actuar y escalar.

## Cómo se prueba

1. Ejecutar la aplicación en local.
2. Abrir el módulo Equipo EVO.
3. Entrar en `Hoy`.
4. Abrir una alta ficticia.
5. Consultar el briefing.
6. Simular el cierre de primera clase.
7. Elegir uno de los tres resultados.
8. Abrir `Seguimientos` y `Excepciones`.
9. Cambiar entre Entrenador y Dirección.
10. Confirmar que cada pantalla tiene una acción principal clara.

## Señal para pasar

- Marian encuentra cada pantalla sin instrucciones;
- el recorrido se entiende;
- el entrenador recibe valor antes de la clase;
- Dirección ve excepciones sin ruido;
- no sobra ninguna pantalla;
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

- Fase activa: ninguna.
- Siguiente fase propuesta: Fase 1.
- Trabajo autorizado actual: documentación únicamente.
- Código modificado: no.
- Producción modificada: no.
- Condición para iniciar Fase 1: aprobación de `PRD.md`, `PLAN.md` y `AGENTS.md`.
