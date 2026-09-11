# Instrucciones operativas del proyecto EVO

## Continuidad y auditoria local — 11 septiembre 2026

- Peticion expresa de Marian de memoria y autonomia guardada tambien en nota de memoria 20260911-105000-autonomia-tecnica-proyecto-evo.md.
- Continuacion de esta tarea activa cada 30 minutos: automation `avance-t-cnico-oficina-evo`. Solo trabajo tecnico seguro y avisos materiales; no autoriza publicaciones, persistencia real, cambios de acceso ni envios.
- Preparado `api/lib/wodBusterScheduleJoinAudit.js`, auditor local NO conectado a rutas: compara contrato normalizado explicito (date ISO local, time HH:mm, className exacto) y devuelve solo conteos. Rechaza duplicados, fechas invalidas y coach ausente. 6 tests ficticios pasan. NO valida aun formatos reales API, cancelaciones, identidad ni autoriza distribuir datos.
- Produccion no modificada en este bloque: sigue `6907332`, dpl_BJgmssKi4CHspxy9mA783HNeLAqx. Main y PRs no vueltos a consultar desde la comprobacion anterior del mismo dia. Siguiente trabajo seguro: revisar formato real con salida minimizada y contrato del adaptador antes de integrar este auditor; no desplegar el checkout completo por inferencia.

## Comprobacion CuantoEnseñan — 11 septiembre 2026

- Fuente oficial indicada por Marian: el coach asignado a cada clase en WodBuster; los cambios realizados alli prevalecen. No mantener un reparto manual divergente.
- Publicado comprobador privado ampliado (commit `6907332`), despliegue `dpl_BJgmssKi4CHspxy9mA783HNeLAqx`, alias programing-evo.vercel.app, READY, build 41s. Cambios solo comprobador/tests y estado, sin interfaz ni sincronizacion.
- Consulta real `teachers-next`: HTTP 200, ok true, 5 registros para proximas 24h. Esquema exacto: Año, Mes, Día, Fecha, Hora, Coach, Entrenamiento, Plazas. No se devolvieron valores personales. Confirma que el endpoint acepta ventana futura y devuelve campo Coach; NO valida aun identidad/asignacion de cada fila frente al horario.
- 553 tests / 100 archivos pasan. Ultima referencia main remota verificada: `312a734434c28885431b417984f62fe90b10720b`. PRs no consultados, main no incorporado.
- Siguiente paso: comprobar formatos de fecha/hora e identificacion inequívoca de clases al cruzar CuantoEntrenan con CuantoEnseñan. La respuesta no expone IDs de clase; no unir solo por nombre/hora ni asumir un coach si hay coincidencias multiples. Antes de mostrar datos a entrenadores, validar vinculacion segura entre identidad de coach WodBuster y acceso al panel.
- Ninguna importacion, persistencia, aviso o tarea automatica activada. La consulta historica adicional no se necesita para demostrar lectura de proximas clases.

## Estado vigente 11 septiembre 2026: autenticacion de lectura confirmada

- Marian confirmo guardar el usuario corregido. Republicado exactamente el despliegue anterior d2207df para cargar las variables actuales, sin cambios de codigo: `https://programing-6zqx8b62d-marianpersonaltrainer-oss-projects.vercel.app`, id `dpl_366CXQYCe2Yshho4g7qjP3R9QkeN`, alias `https://programing-evo.vercel.app`.
- Prueba privada real: HTTP 200, `ok: true`, 90 registros en ultimas 24 horas. Solo se devolvieron conteo y nombres de campos, nunca valores personales. NO equivale a 90 clientes ni 90 asistencias: existen campos de cancelacion.
- Esquema confirmado: Fecha, HoraComienzo, NombreEntrenamiento, Plazas, FechaInscripcion, FechaBorrado, BorradoFueraHora, TipoReserva, Invitado, FechaLecturaTorno, MinutosTarde, IdDistintivo, NombreDistintivo; tambien devuelve identidad/contacto y tarifa, que no deben propagarse indiscriminadamente al panel.
- No aparece identificador ni nombre del entrenador en este esquema. Pendiente contrastar fuente de asignacion por clase y significado documentado de TipoReserva/Invitado. No inferir clase de prueba por Invitado ni asistencia por mera reserva.
- Sin persistencia ni sincronizacion activada. Comprobaciones: prueba sin credencial 401; webhook 404 `wodbuster_coach_events_disabled`; pagina coach 200 (no validacion de acceso autenticado).
- `main` remoto verificado mediante ls-remote: `312a734434c28885431b417984f62fe90b10720b`. PRs no consultados en esta comprobacion. No fusionar main por inferencia.
- Siguiente fase necesita delimitar el piloto real: fuente/identidad estable, asignacion de entrenadores, minimizacion y permisos antes de persistir o distribuir. El bloqueo de credenciales queda resuelto; no pedir recrear el acceso.

## Avance local 11 septiembre 2026: prueba API de datos

### Resultado publicado 11 septiembre, 10:03 Europe/Madrid

Actualizacion 10:23: compatibilidad de Basic Auth Latin-1 restringida al subconjunto seguro de la macro Excel publicada en `d2207df`, despliegue `dpl_FcYUjMToTFio73vTJ17noGsfgWAL`. 11 tests del comprobador pasan. Prueba real sigue dando `upstream_login_redirect`, `legacyEncodingTried: false`; no concluir contrasena erronea ni codificacion descartada. Valor de WODBUSTER_API_USER no recuperable por estar guardado como Secret; se dejo su editor abierto para que Marian introduzca el nombre exacto de la fila de WodBuster, conservando Production y enlace a programing-evo. No se ha cambiado ese valor ni la contrasena.

- Produccion: `dpl_DkLwq6KuNRpnAkhGHtyhNAWiRK7y`, commit `be9d5fe`, alias `programing-evo.vercel.app`. Comprobador protegido publicado con autorizacion expresa. Base anterior de produccion `1223763`; diff solo comprobador/tests y esta nota, sin cambios a src/public/apps/configuracion. `origin/main` actualizado a `312a734` (PR #37), NO incorporado a este despliegue; reconciliacion pendiente, no afirmar paridad con main. Estado de otros PRs no consultado.
- Suite completa inicial: 546 tests; build correcto. Ultima revision del comprobador: 10 tests pasan.
- Prueba real desde Vercel: WodBuster devuelve HTTP 302 al login; resultado sanitizado `upstream_login_redirect`. NO autenticacion valida confirmada, NO datos importados. Revisar pareja usuario/password de API antes de repetir; no cambiar permisos ni crear accesos por inferencia.
- Ruta sin autenticacion devuelve 401. Pagina ?coach devuelve HTTP 200 (no prueba de recorrido autenticado). Receptor de eventos sigue devolviendo `wodbuster_coach_events_disabled`.
- Documentacion Postman leida: Basic Auth, POST urlencoded, Desde/Hasta Epoch. No se sigue ninguna redireccion ni se devuelven valores personales.

- Preparados `api/wodbuster-read-check.js` y `api/lib/wodBusterReadProbe.js`, sin publicar. Consulta solo `CuantoEntrenan`, ultimas 24 horas, devuelve conteo y nombres de campos; no persiste filas ni devuelve valores personales.
- Ruta protegida con el secreto de administracion existente; throttle por instancia, no global. Pruebas con datos ficticios. Consulta real pendiente.
- Variables compartidas WODBUSTER_API_USER, WODBUSTER_API_PASSWORD y WODBUSTER_BOX verificadas en pestana Shared de programing-evo, solo Production. La CLI env ls no las enumera y env run no las entrega: no interpretar eso como ausencia en el panel.
- El receptor de eventos sigue sin activarse. No desplegar este checkout entero sin comparar antes con produccion y main actuales. Estado remoto de main y PRs no actualizado en esta comprobacion; las referencias historicas de abajo no son confirmacion actual.

**Actualizado:** 25 de agosto de 2026 · **Lee este archivo entero antes de tocar nada.**

> **Al terminar cualquier sesión, actualiza el commit de `main` y el estado de los PR de la sección 4.** Es la parte que más rápido envejece: el 25 de agosto quedó señalando un commit ya superado y lo detectó la otra herramienta, no quien lo escribió.

> **Cierre 31 de agosto:** el formulario guiado de feedback de coach (`10ac6b7`) está fusionado en `main` mediante el merge `103cb1b`. Vercel ya había desplegado ese cambio en producción (`dpl_7iZmpAuw7cGq1bmYDkDuAxkdb5e7`); tras subir este registro, comprobar el despliegue automático desde `main` y conservar la rama solo como historial de la revisión.

Este documento es el punto de encuentro entre las distintas herramientas que trabajan en este repositorio (Codex, Claude Code, Cursor). Ninguna puede hablar con las otras: **esta nota es la única memoria compartida.** Si la dejas desactualizada, la siguiente empieza desde una mentira.

---

## 1. Preferencia permanente de Marian

**Reafirmada expresamente el 11 de septiembre de 2026:** continuar el trabajo tecnico seguro sin esperar «trabaja» o «continua». Autorizadas las revisiones de APIs, comprobaciones de conexion y soluciones reversibles dentro del alcance que no afecten a la aplicacion en uso, clientes, finanzas o permisos. No cerrar dejando un paso tecnico propio ejecutable; detenerse solo por intervencion humana imprescindible o decision material nueva. Dar entonces una unica tarea con pasos, campos y textos exactos. No equivale a permiso para activar sincronizaciones, distribuir datos, modificar acceso o cambiar el producto publicado.

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

## 3. Alcance acordado: v1 — CERRADA el 25 de agosto de 2026

**La v1 está completa.** Publicado el trabajo pendiente, reconciliadas base de datos y código, cerrado el acceso anónimo a los datos del equipo, montada la identidad en producción y fusionada la vista estructurada. Producción verificada tras `9a07c8b`: 70 semanas publicadas con 1 activa, 20 check-ins y 95 ejercicios intactos. El 25 de agosto Marian autorizó iniciar la consolidación visible posterior a v1, siempre sin tocar la semana publicada vigente.

Cualquier trabajo nuevo a partir de aquí **abre una fase nueva y necesita decisión expresa de Marian**. Lo que queda pendiente es solo limpieza sin riesgo: cerrar los PRs muertos de la sección 7 y retirar la cadena muerta de `weeks`.

## 3 bis. Cómo se acordó la v1

El 24 de agosto de 2026 Marian decidió que **"app cerrada" = v1 estable y segura, sin funcionalidad nueva**: publicar lo pendiente, reconciliar base de datos y código, y retirar la deuda.

**Aparcado explícitamente, no cancelado:** Equipo EVO (Mi turno e incorporaciones), Mi Camino para clientes, integración con WodBuster, y las fases 3 a 9 de `PLAN.md`.

**Por qué:** `PLAN.md` define 9 fases y el proyecto estaba en la 2.3. Con esa meta, "cerrada" no llegaba nunca. Antes de aceptar trabajo nuevo, comprobar si cabe en la v1; si no cabe, decirlo y aparcarlo con nombre y fecha en vez de empezarlo.

---

## 4. Estado real a 25 de agosto de 2026

- **`main` = `c410cc4`**. El PR #32 se fusionó el 24 de agosto —104 commits parados desde el 11 de agosto—; el PR #33 el 25 de agosto a las 12:56; los PR #34 y #35 añadieron mejoras de lectura y resumen semanal para el equipo; y el PR #36 añadió el Espacio de trabajo seguro de Administración y Coach.
- **Producción:** `programing-evo.vercel.app`, verificada y funcionando: 70 semanas publicadas con 1 activa, 20 check-ins y 95 ejercicios. La vista del entrenador (`?coach`) comprobada por Marian en producción el 25 de agosto: entra con el código compartido de siempre y ve la semana, más el checklist guiado del turno que llegó con el PR #32.
- **`?coach` funciona con el código compartido de siempre.** `COACH_ACCESS_CODE` está configurado en Vercel Production (verificado: el endpoint responde 401, no 500). La identidad individual viene **apagada** por defecto y el fallback de código compartido **activado**.

### Trabajo en vuelo

| Rama / PR | Qué es | Estado |
|---|---|---|
| PR #33 · vista estructurada | Convierte el Excel revisado en sesiones privadas | **Fusionado el 25 de agosto a las 12:56.** Revisado, probado por Marian de principio a fin y verificado en base de datos |
| PR #34 · Mi turno | Aclara que el equipo consulta, dirige y deja feedback; Administración programa | **Fusionado y publicado el 25 de agosto.** CI y build en verde |
| PR #35 · resumen semanal | Muestra al equipo el estado de semana publicada y el progreso de feedback | **Fusionado y publicado el 25 de agosto.** CI y build en verde |
| PR #36 · espacio de trabajo | Entrada visible que separa Administración, borradores, equipo y Coach | **Fusionado el 25 de agosto.** CI y build en verde; no modifica sesiones, envíos, identidad ni la semana publicada |
| `integracion/equipo-evo` | Equipo EVO integrado sobre main (22 commits) | Verde, 559 tests. Inerte tras `?incorporaciones`. Sin PR abierto. **Aparcado** |

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

   **CADUCADA el 25 de agosto de 2026**, tal como estaba previsto: los dos frentes terminaron. Vuelve a aplicar la norma de un solo agente sobre el código a la vez. Si se reabre un reparto, tiene que cumplir otra vez las tres condiciones: territorios sin ficheros compartidos, frontera escrita aquí, y ambos frentes cortos.

   Aprendizaje del reparto: funcionó, pero **las dos herramientas no pueden verse trabajar**. Codex pidió sembrar unos tipos de clase que ya estaban cargados desde hacía veinte minutos. Todo estado compartido tiene que acabar escrito en este archivo o se pierde.
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
| #33 Vista estructurada | **Fusionado.** Flujo completo probado por Marian |
| #34 Mi turno | **Fusionado.** Aclara la responsabilidad operativa del entrenador |
| #35 Resumen semanal Coach | **Fusionado.** Semana publicada y progreso de feedback visibles al equipo |
| #36 Espacio de trabajo Pe2 | **Fusionado.** Navegación segura de Administración/Coach, sin cambios de datos |

Las ramas **no se borran** al cerrar un PR: cerrar es reversible, borrar no.

---

## 8. Restricciones vigentes

- WodBuster está diferido como dependencia de Fase 2 mientras no exista una política EVO aprobada para la API de tornos.
- No promover a Production sin validación proporcional al riesgo.
- El código de acceso de coach se comprueba **solo en el servidor**. No volver a meterlo en el código fuente ni en variables `VITE_*`.
- **No volver a añadir recargas automáticas en cliente ni comprobaciones de build id.** Con el HTML en `no-cache` y los assets con hash no hacen falta. Se intentó tres veces y cada intento empeoró el problema.
