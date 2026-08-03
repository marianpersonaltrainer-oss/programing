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

La experiencia objetivo del entrenador tiene dos áreas principales dentro de la aplicación: `Programación` y `Mi turno`. Las incorporaciones son casos prioritarios dentro de la operativa, no un módulo o destino principal separado.

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

Puede actuar como superficie de lectura.

No será propietario de:

- expediente operativo;
- tareas;
- evidencias;
- historial operativo.

### WodBuster

Continúa siendo propietario de alumnos, reservas, asistencia, horarios, pagos, tarifas y ficha general.

No duplicar en Programming EVO:

- listas completas de alumnos;
- reservas normales;
- asistencia ordinaria;
- pagos o tarifas;
- información general ya consultable en WodBuster.

Programming EVO solo muestra el dato mínimo cuando existe una acción especial.

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

La Fase 1 está en ajuste y pendiente de aprobación visual de Marian. Continúa siendo exclusivamente visual, local, móvil primero y con datos completamente ficticios.

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
- Fase activa: Fase 1 · Arquitectura visual integrada en Programming EVO.
- Fase 1: arquitectura documentada y pendiente de nueva aprobación visual de Marian.
- Código autorizado: no; el prototipo permanece detenido hasta recibir aprobación.
