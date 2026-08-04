# PRD.md
## Programming EVO · Experiencia del entrenador

**Estado:** documento vivo · arquitectura corregida · Fase 1 cerrada y aprobada
**Repositorio:** `marianpersonaltrainer-oss/programing`
**Rama de preparación:** `feature/equipo-evo-f1-visual`
**Código autorizado:** no; Fase 2 pendiente de aprobación
**Fase activa:** ninguna · Fase 2 no iniciada

---

## 1. Contexto del repositorio

Este repositorio contiene la aplicación existente **Programming EVO**, construida con React, Vite, Supabase y funciones desplegadas en Vercel.

La aplicación actual mantiene tres contextos principales:

- vista de programación;
- vista coach mediante `?coach`;
- evolución técnica en `?v2`.

El producto único es **Programming EVO**. No existe ni se proyecta una aplicación separada llamada Equipo EVO, otro login o una navegación independiente.

La experiencia objetivo del entrenador se integra en la misma aplicación mediante `Programación`, `Mi turno`, `Protocolos` y `Mi evolución`. `Protocolos` y `Mi evolución` se presentan como segundo nivel de `Mi turno`. Dirección dispone además de `Operativa`, `Evaluaciones` y `Equipo`. Las incorporaciones son un flujo prioritario de cliente dentro de `Mi turno`, no una aplicación, un área principal ni una arquitectura separada.

Durante la Fase 1 se conserva `?incorporaciones` únicamente como **sandbox temporal local** para validar la propuesta visual sin credenciales ni conexión real. Esta ruta no representa la arquitectura ni la ruta final de producción y deberá revisarse o eliminarse antes de cualquier integración. No reutilizará ni modificará `?v2`, y tampoco alterará `/` ni `?coach`.

**Regla de separación:** Programming EVO es la interfaz principal del entrenador y muestra el dato mínimo necesario para una acción especial, pero WodBuster conserva la propiedad de sus datos y Programming EVO no será propietario único de tareas, incidencias, feedbacks, evaluaciones, evidencias, responsables ni historial operativo.

---

## 2. Problema

El entrenador necesita una única experiencia coherente en Programming EVO. `Programación` debe resolver la preparación y el feedback del entrenamiento; `Mi turno` debe concentrar únicamente las acciones operativas especiales que Programación y WodBuster no resuelven. La versión visual inicial creó una superficie demasiado independiente y centrada en incorporaciones.

Dentro del flujo prioritario de incorporaciones, desde que una persona realiza su primer pago hasta que completa su primera clase:

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

> Conseguir que el entrenador prepare y valore la sesión desde Programación, resuelva las acciones operativas especiales desde Mi turno y no tenga que duplicar la gestión ordinaria que pertenece a WodBuster.

Dentro de este objetivo, cada incorporación debe completar el recorrido desde primer pago hasta primera clase cerrada con responsable, ficha mínima, entrenador informado, evidencia y siguiente paso.

El sistema debe beneficiar simultáneamente a:

- **cliente:** empieza con claridad y acompañamiento;
- **entrenador:** llega preparado y sabe qué hacer;
- **Dirección:** ve excepciones y cumplimiento sin perseguir tareas.

---

## 4. Usuarios

### 4.1 Entrenador

Necesita:

- consultar en `Programación` el entrenamiento, sus notas, objetivo, estímulo y preparación de clase;
- aportar feedback del entrenamiento asociado a la sesión;
- consultar en `Mi turno` la entrada y puntualidad, apertura o relevo y las tareas operativas críticas;
- ver únicamente personas nuevas, adaptaciones, incidencias previas u otros casos que exijan una acción especial;
- registrar una incidencia;
- completar feedback operativo de primera clase o de un caso relevante;
- resolver caja, sala, material, relevo y cierre cuando corresponda;
- consultar protocolos desde la biblioteca o desde una tarea contextual;
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

- turnos sin cerrar;
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
- enlace al protocolo aplicable.

No mostrará diagnósticos médicos detallados, datos económicos ni información ajena a la clase.

Programming EVO no ofrecerá una réplica de la ficha general del alumno. Este briefing solo aparece cuando existe una acción especial y contiene el mínimo contexto necesario para actuar.

---

## 7.1 Propiedad funcional de WodBuster

WodBuster continúa siendo propietario de:

- alumnos;
- reservas;
- asistencia;
- horarios;
- pagos;
- tarifas;
- ficha general.

Programming EVO no duplicará listas completas de alumnos, reservas normales, asistencia ordinaria, pagos, tarifas ni información general disponible en WodBuster. Solo mostrará el dato mínimo cuando active una tarea, excepción o actuación especial.

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

No se transformarán en una checklist obligatoria después de cada clase. Se reservarán para formación, observación por muestra y futuro Ghost Customer. Padrino/Madrina forma parte de la dinámica intuitiva dentro de la clase y no se mostrará como dato del briefing previo.

### Separación de feedback

1. **Feedback de programación:** se asocia al entrenamiento y se guarda dentro de `Programación`.
2. **Feedback operativo o de cliente:** corresponde a primera clase, incidencia, seguimiento o relevo y se gestiona dentro de `Mi turno`.

### Separación de evaluación

1. **Operativa diaria:** puntualidad, apertura, cierre, caja, incidencias, feedbacks, relevo y tareas.
2. **Calidad de clase:** evaluación de Dirección, observación mensual o Ghost Customer basada en el Handbook.

Los criterios del Handbook no se convierten en tareas diarias del entrenador.

---

## 12. Alcance de la Fase 1

La Fase 1 está cerrada y aprobada. Consistió exclusivamente en un prototipo:

- visual;
- local;
- móvil primero;
- con datos completamente ficticios y fijos;
- sin base de datos;
- sin login real;
- sin permisos reales;
- sin integraciones;
- sin datos de clientes reales.

La ruta `?incorporaciones` se mantiene exclusivamente como sandbox temporal local. Puede resolverse antes de la puerta general de Supabase para no exigir credenciales, pero no define la ruta ni la arquitectura final de producción.

No se reutilizará ni modificará `?v2`.

### Navegación objetivo del Entrenador

La experiencia integrada tendrá dos áreas principales:

1. `Programación`;
2. `Mi turno`.

`Programación` conserva:

- entrenamiento del día;
- notas de programación;
- objetivo y estímulo;
- información necesaria para preparar la clase;
- feedback del entrenamiento asociado a la sesión.

`Mi turno` muestra solo lo que WodBuster y Programación no resuelven:

- entrada y puntualidad;
- apertura o relevo;
- briefing especial;
- persona nueva;
- adaptación relevante;
- incidencia previa;
- tareas operativas críticas;
- registro de incidencia;
- feedback de primera clase o caso relevante;
- caja;
- sala y material;
- relevo;
- cierre.

El segundo nivel de `Mi turno` contiene:

1. `Hoy`;
2. `Protocolos`;
3. `Mi evolución`.

La biblioteca de `Protocolos` contiene Apertura, Cierre, Caja, Primera clase, Incidencias, Feedback, Relevo, Seguimiento y Handbook. Cada protocolo puede abrirse desde la biblioteca y también desde una tarea contextual.

### Navegación objetivo de Dirección

Dirección tendrá cuatro áreas principales:

1. `Programación`;
2. `Operativa`;
3. `Evaluaciones`;
4. `Equipo`.

`Operativa` concentra las excepciones de turno y cliente. `Evaluaciones` separa la calidad de clase de la operativa diaria. `Equipo` muestra evolución y cumplimiento sin transformar el Handbook en una lista diaria de tareas.

### Acciones visuales

- consulta de briefing de una incorporación;
- cierre breve y ficticio de primera clase;
- registro visual de incidencia;
- cierre o relevo visual del turno.

### Registro

El expediente operativo debe permanecer neutral y desacoplado de la interfaz de Programming EVO. WodBuster conserva sus dominios de propiedad y Programming EVO evita duplicar su información ordinaria.

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
- información relevante en uno o dos clics;
- una sola navegación integrada en Programming EVO.

### Portabilidad

- Programming EVO actúa como interfaz, no como propietario único del núcleo operativo;
- datos operativos exportables en formatos abiertos y legibles;
- reglas desacopladas de los componentes visuales;
- posibilidad de sustituir interfaz, hosting o proveedor sin perder información, reglas ni historial.

---

## 15. Arquitectura portable futura

Estas decisiones son requisitos de diseño para fases posteriores. Durante la Fase 1 solo se documentan: no autorizan refactorización, base de datos, API, eventos, conectores ni integraciones.

### 15.1 Interfaz y núcleo separados

Programming EVO será la aplicación principal que utilizará el entrenador. Su interfaz podrá consultar y ejecutar acciones del núcleo, pero no deberá convertirse en el propietario único de:

- tareas;
- incidencias;
- feedbacks;
- evaluaciones;
- evidencias;
- responsables;
- historial operativo.

La interfaz deberá poder sustituirse en el futuro sin perder datos ni reglas. El núcleo operativo deberá conservar significado propio al margen de React, de una ruta concreta y del proveedor de hosting.

### 15.2 Lógica fuera de los componentes visuales

Las reglas de negocio futuras no quedarán embebidas dentro de componentes React. Vivirán en módulos de dominio o servicios independientes de la interfaz.

Esto incluye, como mínimo:

- cuándo una tarea está vencida;
- qué bloquea el cierre de un turno;
- quién es responsable de una acción;
- cómo se calcula un KPI;
- cuándo una incidencia escala.

Los componentes visuales representarán estados y solicitarán acciones; no serán la fuente única de estas reglas.

### 15.3 Sistemas externos sustituibles

Se tratarán como sistemas externos y sustituibles:

- WodBuster;
- Canva;
- Google Calendar;
- email;
- Drive;
- cualquier herramienta futura.

Programming EVO no duplicará innecesariamente sus datos. WodBuster seguirá siendo propietario de alumnos, reservas, asistencia, horarios, pagos y tarifas, además de su ficha general conforme a la separación ya definida.

Canva, si se conecta en el futuro, actuará únicamente como generador o destino de recursos visuales. No formará parte del núcleo operativo ni será propietario de tareas, incidencias, feedbacks, evaluaciones o historial.

### 15.4 Adaptadores

Cada integración futura se implementará mediante un adaptador independiente del núcleo y de la interfaz. Nombres conceptuales posibles:

- `WodBusterAdapter`;
- `CanvaAdapter`;
- `CalendarAdapter`;
- `EmailAdapter`.

Estos nombres no definen todavía archivos ni contratos técnicos. La regla es que un proveedor pueda sustituirse cambiando su adaptador, sin reescribir el núcleo ni la interfaz.

### 15.5 API futura

El núcleo deberá poder exponer en el futuro una API documentada para operaciones como:

- consultar tareas del turno;
- registrar incidencias;
- registrar feedback;
- consultar evaluaciones;
- cerrar un turno;
- recibir eventos externos.

No se definen todavía endpoints, protocolos, autenticación ni implementación.

### 15.6 Eventos futuros

El sistema podrá emitir o recibir eventos de dominio como:

- `turno_iniciado`;
- `turno_cerrado`;
- `incidencia_creada`;
- `feedback_pendiente`;
- `primera_clase_detectada`;
- `evaluacion_completada`.

La lista es conceptual y no autoriza buses de eventos, webhooks ni automatizaciones durante la Fase 1.

### 15.7 Exportación y salida

Los datos operativos futuros deberán poder exportarse en formatos abiertos, documentados y legibles. La conservación de la información no dependerá de una única interfaz, hosting o proveedor.

La estrategia de salida deberá cubrir, como mínimo, datos, responsables, estados, evidencias e historial operativo, respetando seguridad y privacidad.

### 15.8 Regla antes de integrar

No se autorizará ninguna integración hasta:

1. validar primero el proceso sin integración;
2. confirmar qué dato es propiedad de cada sistema;
3. revisar la documentación oficial del proveedor;
4. comprobar permisos, límites y posibles costes;
5. probar con datos sintéticos o en staging;
6. obtener la aprobación de Marian.

---

## 16. Criterio de éxito

La primera versión se considera útil cuando:

- el entrenador obtiene valor antes de la clase;
- todas las primeras clases quedan cerradas;
- no existen casos sin responsable;
- Marian identifica excepciones en menos de cinco minutos;
- disminuyen los recordatorios e interrupciones;
- el equipo usa el flujo sin rescate diario.

---

## 17. Estado actual

- `PRD.md` existe.
- `PLAN.md` existe.
- `AGENTS.md` existe.
- Fase 1 cerrada y aprobada por Marian.
- Código de Fase 2 no autorizado hasta su aprobación.
- Fase activa: ninguna; Fase 2 no iniciada.
- Solo está autorizada la preparación documental de la Fase 2.
- Producción modificada: no.

---

## 18. Control de cambios

Toda modificación de objetivo, usuario, permiso, regla, KPI, integración o alcance exige actualizar primero `PRD.md` y después `PLAN.md`.
