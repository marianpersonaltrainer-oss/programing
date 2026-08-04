# AGENTS.md
## Guía operativa para trabajar en Programming EVO

**Estado:** documento vivo
**Repositorio:** `marianpersonaltrainer-oss/programing`
**Rama de preparación:** `feature/equipo-evo-f1-visual`
**Objetivo:** indicar cómo ejecutar, comprobar y modificar el proyecto sin romper producción ni ampliar alcance.

---

## 1. Regla principal

Antes de tocar código:

1. leer `PRD.md`;
2. leer `PLAN.md`;
3. identificar la fase activa;
4. confirmar qué está dentro y fuera;
5. trabajar en rama o worktree independiente;
6. no tocar producción;
7. no avanzar a otra fase sin la prueba principal aprobada.

Si una petición contradice `PRD.md` o `PLAN.md`, detenerse y señalar la contradicción. No resolverla improvisando código.

---

## 2. Estado técnico conocido

Aplicación web basada en:

- Node.js 22;
- React 18;
- Vite 5;
- Tailwind CSS;
- Supabase;
- Vitest;
- funciones serverless en Vercel.

Modos existentes:

- aplicación principal;
- vista coach con `?coach`;
- vista `?v2`.

El producto único es **Programming EVO**. No crear una aplicación llamada Equipo EVO, otro login ni una navegación independiente.

La experiencia objetivo del entrenador contiene `Programación`, `Mi turno`, `Protocolos` y `Mi evolución`; los dos últimos forman el segundo nivel de `Mi turno`. Dirección ve además `Operativa`, `Evaluaciones` y `Equipo`. Las incorporaciones son casos prioritarios dentro de la operativa, no un módulo o destino principal separado.

La ruta `?incorporaciones` es únicamente un sandbox temporal local de Fase 1. Puede abrirse antes de la puerta general de Supabase para funcionar sin credenciales, pero no representa la arquitectura ni la ruta final de producción. No reutilizar ni modificar `?v2`, `/` o `?coach`.

---

## 3. Preparación local

### Requisitos

- Node.js 22.x.
- npm.
- Git.
- Variables locales basadas en `.env.example`.

### Instalación

```bash
npm install
```

### Variables de entorno

Crear `.env.local` a partir de `.env.example`.

Nunca:

- copiar secretos en el chat;
- incluir secretos en commits;
- usar `SUPABASE_SERVICE_ROLE_KEY` en variables `VITE_*`;
- reutilizar claves expuestas;
- usar datos reales en local o staging.

Para la Fase 1 visual no deben crearse, modificarse ni necesitarse variables de entorno, secretos o conexiones reales.

---

## 4. Ejecutar la aplicación

### Desarrollo local

```bash
npm run dev
```

Abrir la URL que indique Vite, normalmente:

```text
http://localhost:5173
```

### Build local

```bash
npm run build
```

### Previsualizar el build

```bash
npm run preview
```

La Fase 1 debe probarse primero con `npm run dev` y después con `npm run build`.

---

## 5. Pruebas disponibles

### Suite completa

```bash
npm run test
```

### Pruebas + build

```bash
npm run test:ci
```

### Prompts y contexto

```bash
npm run test:prompts
```

### Método y generación

```bash
npm run test:method
```

### Reglas EVO

```bash
npm run test:evo-rules
```

### Regla de fase

- Fase 1 visual: `npm run build` obligatorio; pruebas existentes no deben empeorar.
- Desde Fase 2: cada regla de estado nueva necesita al menos una prueba automatizada.
- Desde Fase 3: permisos y persistencia necesitan pruebas específicas.

No se acepta “lo probé visualmente” como única evidencia cuando ya exista lógica.

---

## 6. Flujo de trabajo Git

### Antes de cambiar

```bash
git status
git branch --show-current
git log -5 --oneline
```

### Rama

Usar una rama específica por fase, por ejemplo:

```text
feature/equipo-evo-f1-visual
```

No mezclar este trabajo con:

- PRs del motor de generación;
- arreglos de producción;
- migraciones no relacionadas;
- cambios del Puente Operativo anteriores;
- experimentos de agentes.

### Commits

- pequeños;
- descriptivos;
- una intención por commit;
- sin secretos;
- sin archivos generados innecesarios.

Ejemplo:

```text
feat(equipo-evo): add local visual skeleton for phase 1
```

### Pull request

Debe incluir:

- fase;
- alcance;
- archivos cambiados;
- pruebas ejecutadas;
- resultado de la prueba principal;
- capturas cuando el cambio sea visual;
- confirmación de que producción no se tocó.

No hacer merge sin aprobación de Marian.

---

## 7. Reglas de arquitectura

### Separación obligatoria

#### Interfaz

Lo que ve el entrenador o Dirección.

#### Lógica

Estados, responsables, plazos, cierres, evidencias y excepciones.

#### Integraciones

WodBuster, Calendar, email, Drive y sistemas futuros.

No introducir lógica de negocio dentro de componentes visuales si puede aislarse.

### Programming EVO

Es la aplicación principal que utiliza el entrenador y puede actuar como superficie de lectura y acción.

No será propietario único de:

- expediente operativo;
- tareas;
- incidencias;
- feedbacks;
- evaluaciones;
- evidencias;
- responsables;
- historial operativo.

La interfaz debe poder sustituirse sin perder datos, reglas o historial.

### Núcleo operativo

Las reglas de negocio futuras deben vivir en módulos de dominio o servicios independientes de React. No implementar dentro de componentes visuales:

- cálculo de vencimientos;
- bloqueos del cierre;
- asignación o validación de responsables;
- cálculo de KPI;
- reglas de escalado de incidencias.

Los componentes presentan estados y solicitan acciones; no son la fuente única de reglas. Durante la Fase 1 esta separación se documenta, pero no autoriza refactorizar el prototipo.

### WodBuster

Continúa siendo propietario de alumnos, reservas, asistencia, horarios, pagos, tarifas y ficha general.

No duplicar en Programming EVO:

- listas completas de alumnos;
- reservas normales;
- asistencia ordinaria;
- pagos o tarifas;
- información general ya consultable en WodBuster.

Programming EVO solo muestra el dato mínimo cuando existe una acción especial.

### Sistemas externos y adaptadores

Tratar como proveedores externos sustituibles:

- WodBuster;
- Canva;
- Google Calendar;
- email;
- Drive;
- cualquier herramienta futura.

No duplicar innecesariamente sus datos. Canva, si se conecta, será un generador o destino de recursos visuales y nunca parte del núcleo operativo.

Cada integración futura debe quedar aislada mediante un adaptador independiente. Nombres como `WodBusterAdapter`, `CanvaAdapter`, `CalendarAdapter` y `EmailAdapter` son ejemplos conceptuales, no archivos autorizados durante la Fase 1.

Cambiar un proveedor no debe requerir reescribir el núcleo ni la interfaz.

### API, eventos y exportación futuros

El núcleo deberá poder exponer una API documentada para consultar tareas del turno, registrar incidencias y feedback, consultar evaluaciones, cerrar turnos o recibir eventos externos. No definir endpoints ni implementar una API sin fase aprobada.

Eventos conceptuales futuros:

- `turno_iniciado`;
- `turno_cerrado`;
- `incidencia_creada`;
- `feedback_pendiente`;
- `primera_clase_detectada`;
- `evaluacion_completada`.

No implementar eventos, webhooks o automatizaciones durante la Fase 1.

Los datos operativos futuros deberán exportarse en formatos abiertos y legibles. No depender de una única interfaz, hosting o proveedor para conservar información, responsables, evidencias o historial.

### Puerta antes de persistencia o integración

Antes de crear base de datos, API o conectores deben aprobarse:

- modelo mínimo de datos;
- propietario de cada dato;
- límites entre interfaz, núcleo y adaptadores;
- estrategia de exportación;
- prueba de sustitución de un conector.

Antes de autorizar cualquier integración:

1. validar primero el proceso;
2. confirmar la propiedad de los datos;
3. revisar la documentación oficial del proveedor;
4. comprobar permisos, límites y costes;
5. probar con datos sintéticos o staging;
6. obtener aprobación de Marian.

### Supabase

La aplicación actual ya usa Supabase. Cualquier tabla nueva requiere:

- justificación en `PRD.md`;
- fase aprobada en `PLAN.md`;
- migración independiente;
- RLS revisada;
- pruebas en staging;
- aprobación antes de producción.

No crear tablas durante la Fase 1.

---

## 8. Reglas específicas de la Fase 1

La Fase 1 está cerrada y aprobada por Marian. Sus límites fueron exclusivamente visuales, locales, móviles primero y con datos completamente ficticios. La Fase 2 no está iniciada y su código permanece sin autorización.

Permitido:

- componentes React;
- rutas o estados locales de navegación;
- datos mock fijos;
- estilos;
- estados vacíos;
- mensajes simulados;
- cambio visual Entrenador / Dirección.

Prohibido:

- tablas;
- migraciones;
- login real;
- permisos reales;
- API nueva;
- webhooks;
- WodBuster;
- Calendar;
- email;
- producción;
- datos reales;
- secretos nuevos;
- KPI calculados;
- agentes.

También queda prohibido durante la Fase 1:

- crear adaptadores;
- definir endpoints definitivos;
- implementar eventos;
- crear conectores;
- refactorizar el prototipo para anticipar la arquitectura futura.

### Superficies protegidas

Durante la Fase 1 no se modifican:

- `supabase/**`;
- `api/**`;
- scripts de migración;
- `src/lib/supabase.js`;
- generación y publicación de semanas;
- variables de entorno;
- configuración o despliegue de Vercel;
- caché;
- service worker;
- `/`;
- `?coach`;
- `?v2`;
- producción.

No se realizan peticiones desde `?incorporaciones` a Supabase ni a `api/**`. No hay base de datos, login real, permisos reales, integraciones ni datos de clientes reales.

La Fase 1 debe poder eliminarse sin perder datos ni afectar el funcionamiento actual.

### Navegación objetivo

Entrenador:

- `Programación`;
- `Mi turno`.

Segundo nivel de `Mi turno`:

- `Hoy`;
- `Protocolos`;
- `Mi evolución`.

Dirección:

- `Programación`;
- `Operativa`;
- `Evaluaciones`;
- `Equipo`.

La navegación conserva un máximo de dos niveles. `?incorporaciones` solo aloja temporalmente el sandbox y no añade un nivel ni una navegación de producción.

### Responsabilidad de cada área

`Programación` conserva entrenamiento del día, notas de programación, objetivo y estímulo, preparación de clase y feedback asociado a la sesión.

`Mi turno` contiene únicamente entrada/puntualidad, apertura o relevo, briefing especial, persona nueva, adaptación relevante, incidencia previa, tareas operativas críticas, registro de incidencia, feedback operativo, caja, sala/material, relevo y cierre.

`Protocolos` contiene Apertura, Cierre, Caja, Primera clase, Incidencias, Feedback, Relevo, Seguimiento y Handbook. Deben poder abrirse desde la biblioteca y desde una tarea contextual.

Separar siempre:

- feedback de programación en `Programación` y feedback operativo o de cliente en `Mi turno`;
- operativa diaria y evaluación de calidad de clase;
- criterios del Handbook y tareas diarias del entrenador.

---

## 9. Qué errores evitar

### Alcance

- No convertir una idea futura en funcionalidad actual.
- No añadir Portal Cliente “aprovechando”.
- No añadir CRM, Calendly o agentes.
- No presentar Equipo EVO como producto, aplicación o navegación independiente.
- No presentar `?incorporaciones` como arquitectura o ruta final.
- No duplicar la gestión ordinaria de WodBuster.
- No añadir `Clientes` o `Mi desempeño` como áreas principales del entrenador.

### Datos

- No usar nombres o datos reales en mocks.
- No almacenar diagnósticos médicos.
- No mostrar datos económicos al entrenador.
- No duplicar información de WodBuster sin definir propietario.

### Experiencia

- No crear pantallas sin una acción principal.
- No superar dos niveles de navegación.
- No pedir al entrenador una checklist extensa del Handbook.
- No crear un sistema de solo escritura.
- No obligar a buscar el aviso si puede llegarle.

### Técnica

- No modificar `main` directamente.
- No desplegar desde una rama documental.
- No ejecutar migraciones de producción.
- No alterar secretos o variables de producción.
- No romper `?coach` ni `?v2`.
- No introducir dependencias nuevas sin justificar coste y mantenimiento.
- No acoplar reglas de negocio futuras a componentes React.
- No acceder directamente a un proveedor externo desde componentes visuales.
- No autorizar una integración sin superar la puerta de propiedad, documentación, permisos, costes, staging y aprobación.
- No ignorar tests existentes.
- No ocultar errores con fallbacks silenciosos.

### Despliegue y caché

El estado real de esta rama es:

- `src/main.jsx` no registra ningún service worker ni ejecuta comprobaciones de build en cliente;
- `vite.config.js` solo inyecta un identificador de build informativo y no provoca recargas;
- `vercel.json` marca `/` e `index.html` como `no-cache, no-store, must-revalidate`, y `/assets/*` como inmutable durante un año porque los nombres llevan hash;
- `public/sw.js` no es un service worker funcional de la aplicación: es una lápida temporal para desregistrar instalaciones antiguas, borrar sus cachés y recargar una sola vez los clientes heredados;
- la aplicación actual no registra `public/sw.js`.

Durante la Fase 1 no modificar:

- metadato informativo de build id;
- service worker;
- política de caché;
- `vite.config.js`;
- `vercel.json`;
- `src/main.jsx`.

---

## 10. Prueba principal obligatoria

Al cerrar cada fase devolver:

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

**Pruebas automáticas ejecutadas:**

```text
comando → resultado
```

**Incidencias:**
[errores o diferencias]

**Producción modificada:**
No / Sí, con aprobación

**Decisión de Dirección:**
`Aprobada` / `Ajustar` / `Pausar`

**Cambios documentales:**
PRD / PLAN / AGENTS

---

## Modo de ejecución autónoma

Cuando Marian autorice expresamente una fase de `PLAN.md`, Codex puede trabajar de forma autónoma hasta completar su Prueba principal.

Marian no tiene conocimientos técnicos y debe intervenir lo mínimo posible. No debe actuar como intermediaria entre el plan y la ejecución técnica.

### Autonomía técnica por defecto

Cuando Marian autorice una fase de `PLAN.md`, Codex debe ejecutar de forma autónoma todo el trabajo técnico necesario para completar la Prueba principal.

Debe encargarse sin pedir confirmaciones intermedias de:

- inspeccionar el repositorio;
- decidir la implementación técnica más sencilla compatible con `PRD.md`, `PLAN.md` y `AGENTS.md`;
- crear y modificar archivos dentro del alcance;
- ejecutar comandos locales no destructivos;
- instalar dependencias ya aprobadas por el proyecto;
- arrancar el servidor local;
- ejecutar build y tests;
- diagnosticar errores;
- corregir fallos;
- repetir implementación y pruebas;
- mantener la rama limpia y segura;
- crear commits pequeños;
- actualizar la documentación viva;
- preparar la entrega final de la fase;
- hacer push únicamente a la rama de trabajo cuando la autorización de la fase lo permita.

No debe pedir permiso para:

- leer archivos del repositorio;
- editar archivos incluidos en la fase;
- ejecutar comandos locales no destructivos;
- ejecutar build y tests;
- corregir errores normales;
- crear commits dentro de la rama de trabajo;
- repetir pruebas hasta que funcionen.

### Regla de autocorrección

Un error técnico normal no es motivo para detenerse ni pedir ayuda a Marian.

Ante un fallo, Codex debe:

1. leer el error completo;
2. identificar la causa probable;
3. revisar los archivos relacionados;
4. intentar la corrección más segura;
5. volver a ejecutar la prueba;
6. repetir hasta tres enfoques razonables si fuera necesario;
7. documentar lo ocurrido en la entrega final.

Incluye aquí:

- errores de compilación;
- tests fallidos;
- imports;
- tipados;
- rutas;
- estilos;
- estados locales;
- problemas de configuración local no sensibles;
- conflictos menores dentro de la rama de trabajo.

### Decisiones técnicas

Dentro del alcance aprobado, Codex puede tomar decisiones técnicas reversibles sin consultar a Marian.

Debe elegir siempre:

- la solución más sencilla;
- la menor cantidad de archivos y dependencias;
- arquitectura desacoplada;
- cambios reversibles;
- pruebas antes de ampliar alcance.

No debe pedir a Marian que elija entre opciones técnicas que ella no necesita comprender.

Si existen varias alternativas equivalentes, debe recomendar y ejecutar una opción principal, indicando la decisión en el informe final.

### Intervención humana mínima

Codex solo debe detenerse cuando sea imprescindible una acción que no pueda ejecutar:

- iniciar sesión en un servicio;
- introducir o crear una credencial;
- aceptar un coste;
- aprobar una decisión de negocio;
- autorizar una acción irreversible;
- usar datos reales;
- tocar producción;
- ejecutar una migración de producción;
- conceder permisos del sistema operativo;
- resolver una contradicción funcional que `PRD.md` y `PLAN.md` no aclaran.

No debe detenerse por dudas técnicas normales.

Debe detenerse también cuando aparezca:

- una contradicción entre `PRD.md`, `PLAN.md`, `AGENTS.md` y el repositorio;
- una ampliación del alcance;
- secretos o credenciales;
- un coste nuevo;
- una acción destructiva o difícilmente reversible;
- un fallo que no pueda resolver después de tres intentos razonables.

Nunca puede, sin autorización explícita de Marian:

- hacer merge a `main`;
- desplegar en producción;
- borrar datos o archivos relevantes;
- ejecutar migraciones de producción;
- activar integraciones reales;
- utilizar datos de clientes reales;
- decidir precios, políticas o responsabilidades humanas;
- avanzar a otra fase de `PLAN.md`.

### Formato obligatorio cuando Marian deba intervenir

Cuando sea imprescindible una acción manual, Codex debe responder únicamente con:

#### Acción manual requerida

**Por qué se ha detenido:**
[explicación sencilla, sin jerga]

**Qué debe hacer Marian:**

1. [paso exacto]
2. [botón o campo exacto]
3. [resultado que debe ver]

**Qué no debe hacer:**
[acciones peligrosas o innecesarias]

**Qué debe responder después:**
[una frase concreta como “Hecho” o el texto exacto del error]

Después debe quedar detenido, sin abrir tareas nuevas.

### Permisos de Cursor

Cuando Cursor requiera autorización para comandos seguros:

- agrupar el mayor número posible de comandos relacionados;
- solicitar una sola aprobación;
- explicar en una frase qué ejecutará;
- no pedir una autorización por archivo o prueba;
- no utilizar comandos destructivos para evitar pedir permiso.

### Final de fase

Codex no debe detenerse hasta que:

- la funcionalidad principal esté terminada;
- el build sea correcto;
- los tests aplicables sean correctos;
- la Prueba principal esté ejecutada;
- `PLAN.md` refleje el resultado real;
- los commits de la fase estén creados;
- el estado de Git sea conocido;
- exista una única decisión para Marian: `Aprobada`, `Ajustar` o `Pausar`.

No debe iniciar la fase siguiente automáticamente.

Al finalizar una fase debe devolver:

#### Prueba principal

- Funcionalidad.
- Pasos.
- Resultado esperado.
- Resultado real.
- Incidencias.
- Archivos modificados.
- Build y tests ejecutados.
- Commits y rama.
- Cambios realizados en `PRD.md` o `PLAN.md`.
- Decisión que necesita Marian.

### Relación con Marian

Marian define y aprueba:

- el problema;
- el resultado esperado;
- las decisiones de negocio;
- el inicio y cierre de cada fase.

Codex asume:

- toda la ejecución técnica intermedia;
- diagnóstico y corrección de errores;
- pruebas;
- documentación;
- commits;
- preparación de la revisión.

Regla final:

Marian no debe copiar comandos, interpretar errores ni decidir cómo implementar. Cuando necesite ayuda, compartirá el resultado con su asistente de Dirección, que le indicará una única acción concreta.

---

## 11. Criterios de parada

Detenerse y pedir decisión antes de continuar cuando:

- haga falta un secreto;
- aparezca un coste nuevo;
- sea necesario tocar producción;
- la acción sea irreversible;
- exista contradicción entre documentos;
- se necesite usar datos reales;
- se requiera una integración no validada;
- el cambio amplíe la fase;
- no esté claro quién mantiene la solución.

---

## 12. Mantenimiento de documentos vivos

Actualizar `PRD.md` cuando cambie:

- objetivo;
- usuario;
- permiso;
- regla;
- alcance;
- KPI;
- integración;
- criterio de éxito.

Actualizar `PLAN.md` cuando cambie:

- orden de fases;
- prueba;
- dependencia;
- límite;
- señal de paso.

Actualizar `AGENTS.md` cuando cambie:

- comando;
- entorno;
- proceso de pruebas;
- arquitectura técnica;
- riesgo operativo;
- regla de despliegue.

---

## 13. Estado actual

- `PRD.md` existe.
- `PLAN.md` existe.
- `AGENTS.md` existe.
- Código modificado: sí, exclusivamente prototipo visual de Fase 1.
- Migraciones modificadas: no.
- Producción modificada: no.
- Fase activa: ninguna.
- Fase 1: cerrada, aprobada y respaldada en GitHub.
- Fase 2: preparada documentalmente y pendiente de aprobación.
- Código autorizado: no; no iniciar la Fase 2 hasta recibir aprobación.
