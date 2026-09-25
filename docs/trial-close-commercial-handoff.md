# Relevo de cierre de prueba a Ventas · preparado, no activo

## Objetivo

Cuando un entrenador guarda un **cierre protegido de prueba** en ProgrammingEVO,
la mesa de Ventas podrá revisarlo antes de preparar el siguiente paso.

Esto evita que una prueba que realmente ocurrió quede sin contexto, sin
convertir el formulario del entrenador en un CRM ni en un sistema de mensajes.

## Lo que sí puede pasar al relevo

- referencia interna de la persona;
- asistencia declarada por el entrenador;
- punto de entrada recomendado y prioridad inicial, **solo si vino**;
- identificador y fecha del cierre.

La mesa de Ventas tendrá que vincular el cierre manualmente a una ficha ya
existente. Nunca se relacionará por coincidencia de nombre.

## Lo que nunca pasa al relevo automático

- observaciones del entrenador, adaptaciones o información de salud;
- conversaciones de WhatsApp;
- precios, pagos, reservas, altas o tarifas;
- cambios de etapa, mensajes o tareas enviados.

Un cierre de `canceló`, `cambió fecha` o `no vino` no propone programa ni
prioridad: se queda como caso que requiere contexto antes de decidir nada.

## Estado actual

El contrato y sus pruebas están preparados localmente. No hay lector de eventos
en la mesa de Ventas, no se ha creado una conexión entre aplicaciones y no se
han movido datos reales.

## Activación posterior

Para activarlo hará falta una autorización específica de Marian para crear una
conexión de solo lectura y un punto de revisión privada. La activación deberá
demostrar que:

1. no se crean ni actualizan fichas automáticamente;
2. la vinculación del caso es manual;
3. la persona responsable revisa el cierre antes de pedir un borrador;
4. no se envía ningún mensaje ni se cambia WodBuster.
