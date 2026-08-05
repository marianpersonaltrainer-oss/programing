# PLAN.md
## Plan refinado · Programming EVO

**Estado:** documento vivo · Fase 2.1 aprobada · Fase 2.2 activa
**Repositorio:** `marianpersonaltrainer-oss/programing`
**Rama de preparación:** `feature/equipo-evo-f2-2-registro-primera-clase`
**Código autorizado:** Fase 2.2 · Registro obligatorio de primera clase, autorizada por Marian el 5 de agosto de 2026
**Fase activa:** Fase 2.2 · no iniciar Fase 3

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
16. La interfaz, el núcleo operativo y los adaptadores futuros mantienen límites explícitos.
17. Las reglas de negocio no se implementan dentro de componentes React.
18. Ninguna persistencia, API o integración comienza sin superar la puerta de arquitectura y portabilidad.
19. Los datos operativos futuros deben disponer de una estrategia de exportación abierta.

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

Existe un prototipo visual local aprobado en `?incorporaciones`. Continúa siendo un sandbox temporal, no una aplicación independiente ni la ruta final de producción.

---

## 4. Resumen de fases

| Fase | Resultado visible | Datos | Integraciones |
|---|---|---|---|
| 1 · Cerrada | Prototipo visual aprobado | Ficticios y fijos | Ninguna |
| 2 · Aprobada funcionalmente | Turno mínimo funcional implementado | Persistencia local con datos sintéticos | Ninguna |
| 2.1 · Aprobada | Refinamiento visual de Operativa y Mi turno | Sin cambios | Ninguna |
| 2.2 · Activa | Registro obligatorio y estructurado de primera clase | Persistencia local con datos sintéticos | Ninguna |
| Puerta de arquitectura | Modelo, propietarios, límites y salida aprobados | Diseño | Ninguna |
| 3 | Persistencia y acceso interno | Base propia | Ninguna externa |
| 4 | Flujo real con activación manual | Piloto | Manual |
| 5 | Avisos y bucle de retorno | Piloto | Calendar/email básico |
| 6 | Vista de Dirección e informe semanal | Piloto | Ninguna nueva |
| 7 | Piloto real de 4 semanas | Nuevas incorporaciones | WodBuster manual |
| 8 | Integración WodBuster | Reales | API/RestHook/lectura |
| 9 | Extensiones futuras | Según módulo | Portal, Calendly, etc. |

---

# Fase 1 · Arquitectura visual integrada en Programming EVO · CERRADA

**Resultado:** `Aprobada` por Marian.

**Fase siguiente:** Fase 2 implementada y en revisión.

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
Recorrer visualmente Programming EVO, entender la operativa especial del turno y completar el cierre ficticio de una primera clase sin duplicar WodBuster ni conectar sistemas externos.

**Pasos:**

1. Abrir `?incorporaciones` en local.
2. Confirmar que `Programación` y `Mi turno` aparecen dentro del mismo producto y que Programación existente no se reconstruye.
3. Entrar en `Mi turno > Hoy` y revisar el resumen, un máximo de tres tareas, los casos especiales, las acciones de registro y el fin de turno plegado.
4. Abrir el briefing mínimo de una persona nueva ficticia.
5. Abrir `Cerrar primera clase`.
6. Completar las preguntas sobre cargas/nivel, coordinación/técnica y lo que debe saber el próximo entrenador, todas con máximo recomendado de 180 caracteres.
7. Seleccionar `Incorporación validada`, `Necesita seguimiento` o `Necesita Dirección` y confirmar el cierre simulado.
8. Registrar visualmente una incidencia y revisar el cierre o relevo del turno.
9. Abrir un protocolo desde una tarea contextual y desde la biblioteca; consultar `Mi evolución`.
10. Cambiar a Dirección y localizar Operativa, Evaluaciones y Equipo.

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

**Resultado real:**

- Programming EVO se presenta como producto único con `Programación` y `Mi turno` para Entrenador;
- `Mi turno > Hoy` muestra cinco bloques compactos y un máximo de tres tareas;
- los casos especiales solo incluyen persona nueva, adaptación relevante e incidencia o cambio operativo;
- el cierre de primera clase separa tres notas prácticas del feedback operativo del turno;
- cada nota permite escritura libre breve, muestra un ejemplo y limita visualmente a 180 caracteres;
- están disponibles los tres resultados operativos previstos;
- Protocolos y Mi evolución permanecen en el segundo nivel de Mi turno;
- Dirección muestra Programación, Operativa, Evaluaciones y Equipo;
- no existen listas completas de alumnos, reservas ordinarias, pagos, tarifas o fichas generales;
- todos los nombres y datos son ficticios y estáticos;
- no se realizan peticiones a Supabase, `api/**` ni sistemas externos;
- `/`, `?coach` y `?v2` conservan su comportamiento previo;
- `npm run build` completó correctamente;
- `npm run test` superó 51 archivos y 316 pruebas;
- `git diff --check` terminó limpio;
- producción, Vercel, caché y service worker no fueron modificados.

**Incidencias:**

- el build mantiene la advertencia preexistente sobre chunks superiores a 500 kB;
- no se detectaron errores funcionales ni regresiones automatizadas.

**Producción modificada:** No.

**Decisión de Dirección:** `Aprobada`.

## Señal para pasar

- Marian reconoce Programming EVO como un solo producto y una sola navegación;
- Programación conserva la preparación y el feedback de sesión;
- Mi turno no duplica la gestión ordinaria de WodBuster;
- protocolos y evolución operativa son accesibles en el segundo nivel;
- Dirección distingue Operativa de Evaluaciones;
- estructura y estilo aprobados.

---

# Fase 2 · Turno mínimo funcional

**Estado:** aprobada funcionalmente por Marian el 5 de agosto de 2026; requiere refinamiento visual.

**Código autorizado:** sí; autorización expresa de Marian del 4 de agosto de 2026.

## Objetivo

Convertir el prototipo visual en un único flujo funcional de turno, primero en local o staging, sin integrar todavía WodBuster.

## Flujo que debe poder probarse

`Iniciar turno → registrar hora y entrenador → completar apertura → consultar información especial → registrar incidencia o feedback operativo → completar caja, relevo o cierre → cerrar turno → Dirección ve únicamente las excepciones.`

## Qué se construye

- persistencia mínima de un turno;
- entrenador responsable;
- hora prevista;
- hora registrada;
- estado de puntualidad;
- apertura;
- máximo tres tareas críticas;
- incidencia;
- feedback operativo;
- cierre o relevo;
- vista de excepciones de Dirección;
- datos sintéticos;
- permisos mínimos de prueba.

## Decisión técnica local autorizada

La autorización de la fase concretó una persistencia exclusivamente local, sintética y sustituible. La puerta limitada de Fase 2 queda documentada así:

- modelo mínimo: turno, franja, entrenador, horas, puntualidad, hasta tres tareas, briefing, incidencias, feedback, cierre o relevo y registro de acciones;
- propiedad: los datos son sintéticos del sandbox; Programming EVO no adquiere propiedad sobre datos operativos reales ni sobre datos de WodBuster;
- límites: React presenta el flujo, el dominio contiene las reglas, el servicio coordina acciones y el adaptador contiene `localStorage`;
- salida: el adaptador puede exportar el estado sintético como JSON legible;
- sustitución: una prueba automatizada sustituye `localStorage` por un repositorio en memoria sin cambiar dominio, servicio ni acciones de interfaz.

Esta decisión no supera ni sustituye la puerta obligatoria previa a Fase 3. No autoriza tablas, migraciones, Supabase, API, conectores, permisos reales ni producción.

## Qué queda fuera

- integración con WodBuster;
- API pública;
- Canva;
- Portal Cliente;
- KPI completos;
- evaluación mensual;
- Ghost Customer;
- automatizaciones;
- datos reales;
- producción;
- migración de clientes;
- hacer funcionales todas las pantallas de golpe.

## Prueba principal

**Funcionalidad:**

Completar un turno ficticio de principio a fin y comprobar que Dirección ve la excepción pendiente.

**Pasos:**

1. Entrar como entrenador de prueba.
2. Iniciar turno.
3. Ver la hora registrada.
4. Completar apertura.
5. Registrar una incidencia ficticia.
6. Dejar feedback operativo.
7. Completar cierre o relevo.
8. Entrar como Dirección.
9. Comprobar que la incidencia o tarea pendiente aparece con responsable y siguiente acción.

**Resultado esperado:**

- el turno queda guardado;
- los datos siguen al recargar;
- cada acción tiene responsable y hora;
- no existen duplicados;
- Dirección ve solo excepciones;
- el cierre solo se bloquea por tareas críticas propias;
- no hay conexiones con WodBuster ni producción.

**Resultado real:**

- el entrenador ficticio inició un turno y la aplicación registró responsable, hora prevista, hora real y puntualidad;
- el intento de cierre anticipado mostró el bloqueo por las dos tareas críticas propias pendientes;
- apertura y briefing quedaron completados con responsable y hora;
- la incidencia y el feedback operativo se guardaron localmente;
- el cierre operativo se completó y el turno terminó al 100 % sin que la incidencia abierta lo bloqueara;
- tras recargar, el turno reapareció cerrado con todas las acciones conservadas;
- Dirección mostró únicamente la incidencia abierta, con creador, hora, responsable actual y siguiente acción;
- la validación móvil conservó la navegación de dos niveles y el diseño aprobado en Fase 1;
- las reglas de dominio impiden duplicar un turno de la misma fecha y franja;
- `npm run test:ci` superó 53 archivos y 325 pruebas, seguido de un build correcto;
- `git diff --check` terminó limpio;
- no se modificaron `supabase/**`, `api/**`, migraciones, variables, Vercel, caché, service worker, `/`, `?coach` ni `?v2`.

**Incidencias:**

- el primer arranque local requirió el permiso normal del sistema para escuchar en `127.0.0.1:5173`;
- se mantiene el aviso preexistente de chunks superiores a 500 kB;
- el bundle general mantiene el aviso preexistente de variables Supabase ausentes, aunque `?incorporaciones` no realiza peticiones ni usa persistencia Supabase;
- no quedaron errores funcionales ni regresiones automatizadas.

**Producción modificada:** No.

**Recomendación técnica:** `Aprobada`.

**Decisión de Dirección:** funcionalmente `Aprobada`; la interfaz pasa a Fase 2.1 antes de cerrar la revisión visual.

## Condición para avanzar

- flujo probado en pantalla;
- persistencia correcta;
- cero duplicados;
- build y tests correctos;
- aprobación visual de Marian.

---

# Fase 2.1 · Refinamiento visual de Operativa

**Estado:** aprobada por Marian el 5 de agosto de 2026.

## Objetivo

Mantener íntegra la funcionalidad validada de Fase 2 y hacer que `Mi turno` sea más claro, ligero, guiado y coherente con EVO.

## Alcance autorizado

- menú lateral y cabecera oscuros;
- área principal clara con lila `#F6E8F9`, amarillo cálido `#FFFFE2` y blanco;
- resumen compacto del turno;
- una única tarjeta principal `Ahora` con la siguiente acción;
- casos especiales como lista compacta de máximo tres elementos;
- acciones de registro visualmente subordinadas;
- cierre como acción principal únicamente cuando corresponde;
- menos encabezados, bordes, píldoras, altura y textos repetidos;
- objetivos táctiles mínimos de 44 px;
- Oswald para títulos y Montserrat para lectura;
- presentación sintética `Fuera del horario de prueba` cuando la prueba se ejecuta lejos del horario ficticio.

## Límites

- no cambiar reglas de negocio;
- no modificar dominio, servicio, hook de flujo, adaptador, almacenamiento ni tests funcionales;
- no añadir Supabase, login, WodBuster, integraciones, datos reales ni producción;
- no modificar `/`, `?coach`, `?v2` ni avanzar a Fase 3.

## Prueba visual principal

**Funcionalidad:**

Completar el turno mínimo con una jerarquía visual guiada y comprobar que la misma progresión funciona a 1440 px y aproximadamente 390 px.

**Pasos:**

1. Abrir `?incorporaciones` sin turno y localizar una única acción principal para iniciarlo.
2. Iniciar turno y confirmar que `Ahora` muestra solo la siguiente tarea accionable.
3. Completar apertura y briefing; registrar incidencia y feedback mediante controles secundarios.
4. Confirmar que el cierre gana jerarquía solo cuando corresponde y cerrar el turno.
5. Recargar y comprobar persistencia, prevención de duplicados y excepción de Dirección.
6. Repetir la inspección visual a 1440 px y 390 px.

**Resultado esperado:**

- la siguiente acción se identifica inmediatamente;
- existe una única acción principal visible por bloque;
- el área de trabajo es clara y la navegación permanece oscura;
- responsable y estado no se repiten innecesariamente;
- las tarjetas y listas son compactas;
- la funcionalidad, persistencia, prevención de duplicados y vista de Dirección permanecen intactas;
- tests y build son correctos.

**Resultado real:** superada el 5 de agosto de 2026. A 1440 px, el área clara presenta un resumen compacto y una única tarjeta `Ahora`; a 390 px mantiene la misma secuencia en lectura lineal y objetivos táctiles de 44 px. El recorrido completo permitió iniciar, completar apertura, consultar briefing, registrar una incidencia, preparar el cierre y cerrar el turno. Tras recargar, el turno permaneció cerrado, no reapareció la acción de inicio y Dirección mostró únicamente la incidencia abierta. Al ejecutar fuera de la franja ficticia se mostró `Fuera del horario de prueba` sin modificar la puntualidad almacenada.

**Pruebas automáticas ejecutadas:**

```text
npm run test:ci → 53 archivos y 325 tests correctos; build Vite correcto
```

**Incidencias:** la captura de página completa del navegador local no respetó el lienzo emulado; se repitió como captura del viewport. No afectó al render, cuyas dimensiones CSS verificadas fueron 1440 × 1000 y 390 × 844.

**Producción modificada:** No.

**Decisión de Dirección:** `Aprobada`; la siguiente fase autorizada es Fase 2.2.

## Condición de cierre

- prueba visual superada en escritorio y móvil;
- flujo funcional completo sin regresiones;
- build y tests correctos;
- aprobación visual de Marian.

---

# Fase 2.2 · Registro obligatorio de primera clase

**Estado:** activa y autorizada por Marian el 5 de agosto de 2026.

## Objetivo

Convertir `Cerrar primera clase` en un registro estructurado obligatorio, breve y persistente, sin añadir historial completo de entrenamientos ni modificar el resto del turno mínimo.

## Flujo

`Abrir Cerrar primera clase → completar Movimiento y técnica → completar Molestia o lesión → completar Trabajo completado → guardar con entrenador y hora → recuperar al recargar sin duplicados.`

## Especificación cerrada

### 1. Movimiento y técnica

**Pregunta:** ¿Cómo se movió durante la clase?

Opciones exactas:

- Se movió bastante bien.
- Necesita bastante guía y corrección.
- Tiene poca movilidad o coordinación y hay que estar muy pendiente.

Campo breve opcional: `¿Qué movimiento o aspecto debemos seguir trabajando?`

### 2. Molestia o lesión

**Pregunta:** ¿Cómo respondió la molestia o lesión durante el entrenamiento?

Opciones exactas:

- No tenía molestia.
- Pudo entrenar sin dolor.
- Necesita bastantes adaptaciones porque la molestia limita el entrenamiento.

Campos breves opcionales:

- `Zona de la molestia.`
- `Adaptación que funcionó.`
- `Observación para el siguiente entrenador.`

No se incluye una escala obligatoria de dolor de 0 a 10.

### 3. Trabajo completado

**Pregunta:** ¿Qué parte del entrenamiento completó y con qué carga?

Campos:

- volumen completado: `25 %`, `50 %`, `75 %` o `100 %`;
- pesos o cargas utilizados;
- ejercicios adaptados o sustituidos.

Son obligatorias las tres selecciones principales y los dos campos de texto de Trabajo completado. Los campos marcados como opcionales pueden quedar vacíos.

## Reglas

- existe un único registro de primera clase por turno sintético;
- guardar de nuevo no crea duplicados;
- el registro conserva entrenador responsable y hora;
- `Cerrar primera clase` es la tercera tarea crítica propia del turno;
- el cierre sigue bloqueándose solo por tareas críticas propias y nunca supera tres;
- el registro persiste mediante el mismo servicio y adaptador local sustituible;
- Dirección conserva su vista exclusiva de excepciones y no recibe actividad rutinaria;
- no se añade historial completo de entrenamientos;
- no se añaden preguntas, escala de dolor, diagnósticos ni datos reales.

## Persistencia y arquitectura

- ampliar el modelo local del turno con un único `firstClassRecord`;
- mantener reglas y validación fuera de React;
- coordinar la acción desde el servicio de turno;
- conservar `localStorage` detrás del adaptador existente;
- mantener exportación JSON y prueba de sustitución por memoria;
- no añadir dependencias, Supabase, API, tablas, migraciones o integraciones.

## Prueba principal

**Funcionalidad:**

Completar y recuperar un registro obligatorio de primera clase con los tres bloques exactos.

**Pasos:**

1. Iniciar un turno sintético y completar apertura y briefing.
2. Abrir `Cerrar primera clase` y comprobar que solo aparecen los tres bloques definidos.
3. Verificar que no se puede guardar sin las selecciones obligatorias ni los campos requeridos de Trabajo completado.
4. Completar las opciones, guardar y confirmar entrenador y hora.
5. Recargar y comprobar que el registro continúa guardado y no se duplica.
6. Completar cierre o relevo, cerrar el turno y confirmar que Dirección conserva únicamente sus excepciones.

**Resultado esperado:**

- las preguntas y opciones coinciden exactamente con la especificación;
- los campos opcionales pueden quedar vacíos;
- no existe escala de dolor de 0 a 10 ni preguntas adicionales;
- el registro obligatorio desbloquea su tarea crítica y queda asociado a responsable y hora;
- persistencia, prevención de duplicados, cierre y Dirección mantienen sus reglas;
- escritorio y móvil conservan el patrón visual de Fase 2.1;
- tests y build son correctos.

**Resultado real:** pendiente de ejecución.

## Fuera de alcance

- historial completo de entrenamientos;
- nuevas preguntas o resultados generales de incorporación;
- datos reales o diagnósticos clínicos;
- Supabase, API, migraciones, login real o WodBuster;
- cambios en `/`, `?coach`, `?v2`, producción o Fase 3.

---

# Puerta obligatoria previa a la Fase 3 · Arquitectura y portabilidad

Antes de iniciar esta fase o de crear cualquier base de datos, API o conector, Marian deberá aprobar:

- modelo mínimo de datos;
- propietario de cada dato;
- límites entre interfaz, núcleo y adaptadores;
- estrategia de exportación en formatos abiertos y legibles;
- prueba conceptual de sustitución de un conector sin reescribir el núcleo ni la interfaz.

La puerta deberá demostrar además que:

- las reglas de vencimiento, bloqueos de cierre, responsables, KPI y escalado vivirán fuera de componentes React;
- Programming EVO no será propietario único de tareas, incidencias, feedbacks, evaluaciones, evidencias, responsables ni historial;
- los sistemas externos no se convierten en parte del núcleo;
- la información podrá sobrevivir al cambio de interfaz, hosting o proveedor.

No superar esta puerta mantiene la Fase 3 bloqueada documentalmente.

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

Calendar o email solo podrán incorporarse después de superar la puerta de arquitectura y la regla de autorización de integraciones. Cada proveedor se conectará mediante un adaptador independiente.

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

Antes del spike técnico deberá repetirse la puerta de autorización para esta integración:

- proceso validado sin conector;
- propiedad de cada dato confirmada;
- documentación oficial revisada;
- permisos, límites y costes comprobados;
- prueba con datos sintéticos o staging;
- aprobación de Marian.

Después, spike técnico:

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

La integración se aislará tras un adaptador sustituible. Un cambio de WodBuster no podrá exigir reescribir el núcleo o la interfaz.

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

Canva, Calendar, email, Drive y cualquier nueva herramienta requerirán adaptador independiente y la misma puerta de autorización. Canva solo podrá actuar como generador o destino de recursos visuales, nunca como parte del núcleo operativo.

## Criterios transversales para API, eventos y salida

Si una fase futura autoriza una API, deberá documentarse sin acoplarla a la interfaz y podrá cubrir conceptualmente tareas del turno, incidencias, feedbacks, evaluaciones, cierre de turno y recepción de eventos externos. No se fijan endpoints durante la Fase 1.

Los eventos conceptuales `turno_iniciado`, `turno_cerrado`, `incidencia_creada`, `feedback_pendiente`, `primera_clase_detectada` y `evaluacion_completada` no se implementarán hasta una fase expresamente aprobada.

Toda persistencia futura deberá incluir una prueba de exportación de datos operativos, responsables, estados, evidencias e historial en formatos abiertos y legibles.

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
- Fase activa: Fase 2.2 · Registro obligatorio de primera clase.
- Fase 1: cerrada y aprobada por Marian.
- Fase 2: aprobada funcionalmente por Marian.
- Fase 2.1: aprobada por Marian.
- Fase 2.2: autorizada y activa en `feature/equipo-evo-f2-2-registro-primera-clase`.
- Trabajo autorizado actual: registro estructurado obligatorio de primera clase con persistencia local sintética.
- Código autorizado después del cierre: no iniciar Fase 3.
- Código modificado: sí, prototipo visual de Fase 1 y turno mínimo funcional local de Fase 2.
- Producción modificada: no.
- Condición para iniciar Fase 1: cumplida.
- Condición para iniciar Fase 2: cumplida mediante autorización expresa y puerta local documentada.
- Condición para iniciar Fase 3: bloqueada hasta aprobación de Marian y superación de su puerta obligatoria de arquitectura y portabilidad.
