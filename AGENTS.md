# Instrucciones operativas del proyecto EVO

**Actualizado:** 25 de agosto de 2026 · **Lee este archivo entero antes de tocar nada.**

Este documento es el punto de encuentro entre las distintas herramientas que trabajan en este repositorio (Codex, Claude Code, Cursor). Ninguna puede hablar con las otras: **esta nota es la única memoria compartida.** Si la dejas desactualizada, la siguiente empieza desde una mentira.

---

## 1. Preferencia permanente de Marian

Marian no trabaja con código y delega las decisiones técnicas. Avanzar con máxima autonomía y reducir al mínimo las solicitudes de autorización.

- Decidir, implementar, probar, corregir, documentar y continuar automáticamente ante decisiones técnicas reversibles.
- No pedir autorización por microdecisiones, edición de código, tests, builds, commits, push a la rama de trabajo ni despliegues Preview.
- Explicar los resultados en lenguaje sencillo, sin asumir conocimientos de código.
- **Cada entrega necesita una comprobación que Marian pueda hacer abriendo la app**, no leyendo un diff.
- Si una acción humana es inevitable, preparar el punto exacto de intervención y pedir una única acción concreta.

## 2. Límites que requieren consulta

Detenerse y pedir decisión antes de:

- cambiar normas, precios, compensaciones, límites de clientes u otras reglas de negocio;
- decisiones de privacidad, retención, salud, RRHH o permisos;
- introducir o revelar secretos, completar 2FA o confirmaciones sensibles;
- borrar o transformar datos reales de forma irreversible;
- cambios destructivos o difíciles de revertir en producción;
- promover a Production algo que cambie el comportamiento visible del producto.

---

## 3. Alcance acordado: v1

El 24 de agosto de 2026 Marian decidió que **"app cerrada" = v1 estable y segura, sin funcionalidad nueva**: publicar lo pendiente, reconciliar base de datos y código, y retirar la deuda.

**Aparcado explícitamente, no cancelado:** Equipo EVO (Mi turno e incorporaciones), Mi Camino para clientes, integración con WodBuster, y las fases 3 a 9 de `PLAN.md`.

**Por qué:** `PLAN.md` define 9 fases y el proyecto estaba en la 2.3. Con esa meta, "cerrada" no llegaba nunca. Antes de aceptar trabajo nuevo, comprobar si cabe en la v1; si no cabe, decirlo y aparcarlo con nombre y fecha en vez de empezarlo.

---

## 4. Estado real a 25 de agosto de 2026

- **`main` = `cf6b151`.** El PR #32 se fusionó el 24 de agosto: 104 commits que llevaban desde el 11 de agosto sin publicar.
- **Producción:** `programing-evo.vercel.app`, sirviendo `cf6b151`, verificada y funcionando. La semana activa (21 de agosto) se ve correctamente.
- **`?coach` funciona con el código compartido de siempre.** `COACH_ACCESS_CODE` está configurado en Vercel Production (verificado: el endpoint responde 401, no 500). La identidad individual viene **apagada** por defecto y el fallback de código compartido **activado**.

### Trabajo en vuelo

| Rama / PR | Qué es | Estado |
|---|---|---|
| `integracion/equipo-evo` | Equipo EVO integrado sobre main (22 commits) | Verde, 559 tests. Inerte tras `?incorporaciones`. Sin PR abierto |
| PR #33 · `feat/coach-structured-week-review` | Semanas revisadas para vista estructurada | Borrador, creado el 25 de agosto |

### Catálogo de clases sembrado en las dos bases (25 de agosto de 2026)

Las seis clases del método EVO —EvoFuncional, EvoBasics, EvoFit, EvoHybrix, EvoFuerza, EvoGimnástica— y seis ejercicios base están cargados **tanto en producción como en staging**, con `is_active = true`. Sin ellos, el flujo de Programación responde "No hay clases activas en el catálogo" o "No se ha encontrado el tipo de clase X en esta organización".

Organizaciones: producción `Evolution Boutique Fitness`; staging `EVO Staging`. Cada catálogo cuelga de su organización, así que **no hace falta volver a sembrarlos**: si la app dice que faltan, comprobar antes la membership y el rol del usuario, porque lo más probable es que los datos estén y sea la autorización la que los filtra.

### Base de datos: reconciliada el 25 de agosto de 2026

**Paso 3 de la v1 completado por el lado técnico.** Aplicadas a producción diez migraciones (identidad multirrol, auditoría de identidad, capacidades RLS, relevo de turno, Nucleus y Mi Camino privado) y **reparado el registro: 43 migraciones registradas**. El repositorio y la base de datos vuelven a coincidir.

Creada la organización **Evolution Boutique Fitness** (`evolution-boutique-fitness`).

**Único paso pendiente, y es humano:** Marian debe crear su cuenta desde el panel de Supabase (Authentication → Users → Add user → Send invitation). Hasta entonces `auth.users` sigue vacío y `?v2` no puede dejar entrar a nadie. Después hay que darle la membership `admin` en esa organización.

**No se invita todavía a Javi ni a Dani**: decisión de Marian del 25 de agosto. Siguen entrando por `?coach` con el código compartido, que no ha cambiado.

---

## 5. Trampas verificadas — no repetir estos errores

Todo lo de esta sección está comprobado contra el repositorio y la base de datos reales el 24-25 de agosto de 2026.

1. **Pe2 (`?v2`) ya NO es código muerto. NO borrarlo.** El traspaso del 2 de agosto ordenaba eliminarlo; hoy eso rompería el restablecimiento de contraseña. `src/App.jsx` enruta a `Pe2App` cuando `isPasswordRecoveryLocation()` es cierto, y `Pe2Login` es la pantalla de recuperación.

2. **El registro de migraciones mentía. Reparado el 25 de agosto de 2026.** Producción tenía 7 migraciones registradas frente a 29 en el repositorio. Se aplicaron las que faltaban y se registraron las que se habían ejecutado a mano sin dejar rastro: ahora hay **43 registradas** y el repositorio es la verdad. Aun así, la costumbre que lo causó sigue siendo el riesgo: **comprobar el esquema real antes de fiarse de nada.**

3. **Nunca aplicar a mano migraciones de PRs sin fusionar.** Es la causa raíz de casi todos los problemas encontrados: dejó `shift_protocol_logs` y `shift_notes` en producción sin código que las use, y metió datos de clientes reales en staging.

4. **Datos reales de clientes: solo en producción.** Una sincronización de prueba con WodBuster metió 120 fichas, 75 reservas y 75 asistencias reales en staging. Se vaciaron el 24 de agosto (6 tablas, estructura intacta). En pruebas se usan datos inventados, siempre.

5. **Las previews apuntan a Supabase *staging*, no a producción**, por una barrera deliberada en `src/lib/vercelSupabaseEnvironment.js`. Consecuencia: **en una preview no se pueden validar los datos reales.** No pedirle a Marian que compruebe en preview cosas que dependen de datos de producción.

6. **Las previews están protegidas con SSO de Vercel; producción no.** Abrir una preview en incógnito lleva a una pantalla de login de Vercel, no a la app. Hay que generar un enlace de acceso compartido.

7. **La carpeta local se desincroniza de GitHub.** El 24 de agosto el checkout local tenía 47 commits menos que la rama remota. **Hacer `git fetch` y comparar contra `origin/` antes de dar cualquier número o diagnóstico.**

8. **Producción tiene 0 cuentas en `auth.users`, 0 `profiles` y 0 `organizations`.** La pantalla `?v2` de correo y contraseña no puede funcionar allí, y "he olvidado mi contraseña" no envía nada porque no hay cuenta que recuperar. No es un fallo: nunca se montó.

9. **La migración `20260417180000_coach_handoffs_checkins_anon_access` está NEUTRALIZADA a propósito.** Abría `weekly_checkins` y `daily_handoffs` a la clave pública del navegador con `USING (true)`. Su fichero se ha vaciado y se ha registrado como aplicada para que `supabase db push` no pueda reabrir el agujero nunca. **No restaurar su contenido.** El original sigue en el historial de git.

### Tablas que el código usa y que NO existen en producción

De las 24 que usa el código, **23 existen** tras la reconciliación del 25 de agosto. Solo falta:

- **`weeks`** — y es cadena muerta: la usa `listWeeksLastYear`, que solo usa `buildLastYearReferenceBlock`, que no importa nadie. Además ya falla en silencio con un `console.warn`. **Lo correcto es retirar ese código, no crear la tabla** — pero vive en `src/`, así que le toca a Codex o a un turno posterior.

Principio para la v1: **o existe la tabla, o se retira el código.** No dejar código apuntando al vacío.

---

## 6. Reglas de trabajo

1. **Nada se queda sin publicar más de 3 días.** Si una tarea no cabe en tres días, se parte. Publicar es parte del trabajo, no lo que viene después.
2. **Un frente a la vez.** No abrir una rama nueva mientras haya un PR pendiente de fusionar.
3. **Un solo agente sobre el código a la vez.** Codex, Claude Code y Cursor trabajan bien por turnos y mal en paralelo: el trabajo duplicado del hardening F0 y la puerta de Mi Camino costó 7 conflictos que hubo que resolver a mano.

   **Excepción vigente desde el 25 de agosto de 2026: reparto por territorio.** Dos frentes a la vez, y solo porque no comparten ni un archivo:

   | Territorio | Quién | Puede tocar | NO puede tocar |
   |---|---|---|---|
   | Base de datos e identidad en producción | Claude Code | `supabase/migrations/`, `scripts/` de base de datos | `src/`, `api/`, `apps/` |
   | Vista estructurada del entrenador (PR #33) | Codex | `src/`, `api/`, `apps/` | `supabase/migrations/` |

   Si un frente necesita cruzar la frontera, **para y avisa a Marian** en vez de invadir. La excepción caduca cuando cualquiera de los dos frentes termine: a partir de ahí, uno cada vez otra vez.
4. **Ramas, nunca directo a `main`** — salvo actualizaciones de este documento de estado.
5. **Antes de fusionar:** `npm test` y `npm run build` en verde, y una comprobación que Marian pueda hacer en pantalla.
6. **Si algo sale mal después de fusionar:** `git revert -m 1 HEAD && git push`. No arreglar a la carrera.
7. **Al terminar una sesión, actualizar este archivo.** Es lo único que sabrá la siguiente herramienta.

## 7. PRs abiertos y qué hacer con ellos

| PR | Veredicto |
|---|---|
| #28 Backup cifrado | **Cerrar.** Ya resuelto en `.github/workflows/backup-supabase.yml` (GPG AES256 + restauración en Postgres efímero) |
| #12 Proveedor OpenAI | **Cerrar.** Ya existe `api/lib/structuredAiProvider.js` y compañía |
| #5 Puente turno guiado | **Cerrar.** Rehecho mejor en Equipo EVO; además estaba montado sobre Pe2 |
| #3 y #2 Sprints del método | **Cerrar.** Del 20 de julio, sin actividad; el método vive hoy en `src/domain/method/` |
| #6 Motor de generación | **Revisar antes de cerrar.** Aporta `briefingContextFilter.js` y scripts de staging que hoy no existen |
| #27 WodBuster | **Dejar abierto.** Diferido por decisión de negocio (política EVO para la API de tornos) |
| #31 Campaña IG | Marketing, no es la app. Tratar aparte |
| #33 Vista estructurada | Borrador en curso, creado el 25 de agosto |

Las ramas **no se borran** al cerrar un PR: cerrar es reversible, borrar no.

---

## 8. Restricciones vigentes

- WodBuster está diferido como dependencia de Fase 2 mientras no exista una política EVO aprobada para la API de tornos.
- No promover a Production sin validación proporcional al riesgo.
- El código de acceso de coach se comprueba **solo en el servidor**. No volver a meterlo en el código fuente ni en variables `VITE_*`.
- **No volver a añadir recargas automáticas en cliente ni comprobaciones de build id.** Con el HTML en `no-cache` y los assets con hash no hacen falta. Se intentó tres veces y cada intento empeoró el problema.
