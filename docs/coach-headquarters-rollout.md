# EVO Coach Headquarters v1 — traslado seguro

## Objetivo

Evolucionar la vista actual de entrenador dentro de Programing EVO sin perder
las clases publicadas, el feedback ni el acceso que funciona hoy.

## Estado actual

- La nueva interfaz existe únicamente en la rama `feature/coach-headquarters-v1`.
- Se activa con `?coachTodayPreview=1`; la ruta de demostración local usa datos
  ficticios y se limita al modo desarrollo.
- La vista nueva reutiliza las clases y el feedback publicado existentes.
- No consulta Anthropic, no publica programación, no envía mensajes y no
  almacena adaptaciones de personas.

## Despliegue por puertas

1. **Vista sin cambio operativo.** Publicar primero la interfaz como opción de
   previsualización y comprobar con los accesos actuales que muestra la semana
   publicada y su feedback.
2. **Identidad individual.** Verificar en Producción que cada entrenador se
   identifica con su propia sesión. El código compartido puede conservarse como
   transición para las clases genéricas, pero no autoriza datos personales.
3. **Adaptaciones individuales.** Definir la tabla, retención y RLS antes de
   guardar la primera nota. Solo el entrenador asignado y Marian podrán leer
   una adaptación de una persona.
4. **Consulta al Head Coach.** Conectar el botón a un gateway privado del
   agente programador propio. La petición llevará solo el contexto mínimo de
   clase, método y notas permitidas; nunca llama al soporte Anthropic existente.
5. **Prueba real y sustitución.** Probar con una clase real en modo lectura,
   conservar la pantalla anterior como vuelta atrás y sustituirla solo tras la
   comprobación visible de Marian.

## Límites de seguridad

- No hay publicación automática, cambios de WodBuster ni mensajes de WhatsApp.
- La biblioteca general de método no contiene nombres ni historial clínico.
- Las notas individuales no se activan hasta que identidad, permisos y
  retención estén verificados en Producción.
