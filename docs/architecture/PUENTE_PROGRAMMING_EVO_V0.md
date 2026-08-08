# Control de turno · Programming EVO V0

## Decisión de producto

El control de turno vive en Programing, dentro de `/?v2`, porque los entrenadores ya trabajan aquí. No se crea una pantalla paralela en Cerebro EVO ni se reutilizan sus tablas.

La superficie `Mi turno` sigue esta secuencia:

1. Qué toca ahora.
2. Personas a tener en cuenta.
3. Novedades del turno.
4. Anotar algo.
5. Finalizar turno.

El avance principal se expresa como tareas completadas (`1 de 3 tareas completadas`), no como porcentaje. Las tres tareas son apertura, revisión —incluido el seguimiento de primera clase cuando corresponda— y finalización.

## Integración y roles

- `coach`: Mi turno y Recursos EVO.
- `programmer`: programación V2, Recursos EVO y Control de turnos.
- `programmer` representa a Dirección en V0; no se crea un segundo sistema de roles.
- `/` y `/?coach` continúan funcionando mientras se provisionan las cuentas V2.

## Datos y seguridad

La migración `20260808120000_guided_shift_control.sql` crea dos tablas aditivas e inmutables:

- `shift_protocol_logs`: apertura, revisión y finalización, separados por `shift_id` para permitir varios turnos por persona y día.
- `shift_notes`: novedades del equipo y seguimientos post-clase estructurados.

El seguimiento post-clase contiene:

- movilidad/técnica;
- molestia o lesión: no tenía, estable, mejoró o empeoró, con zona e intensidad 0–10 cuando corresponde;
- trabajo completado: 25/50/75/100 %, cargas y ejercicios adaptados.

La base de datos:

- impone `user_id`, `org_id`, `id` y `created_at` mediante la sesión autenticada;
- valida longitudes, opciones, intensidad, volumen y campos condicionales;
- serializa escrituras del mismo turno y exige apertura → revisión → seguimiento de primera clase, si existe → finalización;
- impide completar dos veces el mismo paso;
- no concede `UPDATE` ni `DELETE` a usuarios autenticados;
- limita a cada entrenador sus logs y las notas de su organización del día actual en `Europe/Madrid`;
- permite a Dirección consultar el historial de su organización;
- limita la actualización del perfil propio a `full_name`; `role` y `org_id` quedan reservados a administración segura.

La ventana diaria de las notas es una decisión de minimización de datos para V0: sirve al relevo del mismo día. Si el seguimiento debe seguir visible al día siguiente, hay que introducir una caducidad explícita (`visible_until`) en vez de abrir todo el historial a entrenadores.

## Despliegue

- Preview debe usar exclusivamente el proyecto Supabase de staging `dgkvaorzuebdloegumai`.
- Producción debe usar exclusivamente `wxrqvcthrkabjllvqghq` y el proyecto Vercel canónico `programing-evo`.
- Ninguna clave privada puede usar prefijo `VITE_`.
- El validador de build bloquea una combinación de destino insegura.

La migración se prueba sin red ni credenciales con:

```bash
npm run test:migration:shift-protocols
```

El smoke usa PostgreSQL embebido y cubre varios turnos diarios, secuencia, primera clase, restricciones, RLS, identidad/hora, inmutabilidad, separación entre organizaciones y lectura de Dirección. CI ejecuta este smoke además de Vitest y el build.

Producción necesita `organizations`, `profiles`, `pe2_my_org()`, `pe2_my_role()` y cuentas Auth provisionadas antes de activar `/?v2`. No se debe usar `supabase db push --include-all` mientras el ledger histórico no coincida con el esquema existente.

La reversión segura consiste en desactivar u ocultar la superficie conservando las tablas. El frontend anterior no es compatible con la nueva columna obligatoria `shift_id`; no se debe borrar la migración ni perder registros operativos.

## Fuera de V0

- CRM, WodBuster, Drive como fuente automática o fichas maestras de personas.
- Tablas o pantallas de Cerebro EVO.
- KPIs, evaluaciones, alertas y gestión de equipo.
- Selección estructurada de clase/sesión y continuidad de seguimientos entre días.
- Cambio de la política de retención histórica de Dirección o borrado/anonimización de cuentas; requieren decisión explícita.

## Prueba manual pendiente

Antes de activar cuentas reales, un perfil `coach` debe recorrer en móvil: turno sin primera clase, turno con primera clase, incidencia, segundo turno el mismo día y lectura de Dirección. Staging aún no dispone de un perfil `coach`, por lo que este smoke autenticado no puede sustituirse con las cuentas actuales de Dirección.
