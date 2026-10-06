# Programming EVO · Núcleo operativo del equipo · V1

**Estado:** listo para prueba sintética; sin conexión real a WodBuster,
WhatsApp ni datos de alumnos.

## Resultado esperado en el panel del entrenador

Al abrir `?coach`, cada entrenador ve solo:

1. su turno y programación semanal;
2. tareas que le corresponden;
3. pruebas, primeras semanas y relevos de las personas que atenderá;
4. si es su primera clase con una persona, el resumen útil de su inicio y la
   evolución registrada por el equipo durante los primeros tres meses;
5. qué debe observar y qué cierre debe dejar;
6. avisos operativos mínimos.

## Circuito único

```text
evento autorizado → Programming EVO → tarea + relevo del coach asignado
                                         ↓
                                  cierre / nota útil
                                         ↓
                              siguiente coach + resumen Marian
```

Eventos iniciales: `trial.confirmed`, `trial.completed`,
`onboarding.started`, `coach.note.requested`, `coach.note.created` y
`task.completed`.

## Límites

- WodBuster será fuente de reserva, asistencia y alta solo cuando exista acceso
  individual autorizado. No se infiere nada desde un chat.
- WhatsApp solo aportará un resumen mínimo que Vera haya validado; no se copia
  una conversación completa al panel.
- El coach no ve pagos, tarifas, teléfonos, correos, conversaciones completas
  ni diagnósticos. Sí ve el historial deportivo mínimo de una persona cuando
  tiene una clase futura o activa asignada con ella.
- Una precaución de salud se redacta como acción útil para la sesión. Los casos
  sensibles escalan a Marian.
- Hasta activar identidades individuales no entran datos reales, porque el
  código compartido del equipo no permite permisos por entrenador.

## Prueba de hoy

`src/domain/operations/coachOperationsProjection.test.js` cubre un recorrido
ficticio: prueba confirmada y primera semana → dos tareas y dos relevos para
un coach; otro coach no ve nada; al cerrar una tarea desaparece de su cola.

La pantalla de demostración está en `?coach` → **Personas nuevas** y muestra
el mismo circuito con datos ficticios.

## Activación real, en este orden

1. activar accesos individuales para cada coach;
2. crear almacenamiento con RLS para eventos y relevos;
3. probar una única prueba real asignada a un entrenador;
4. conectar WodBuster en lectura mínima al evento `trial.confirmed`;
5. conectar Vera a la entrada de contexto mínimo;
6. añadir WhatsApp únicamente para borradores aprobados o avisos internos que
   no contengan información sensible.
# Conexión WodBuster: contrato de entrada preparado

El panel ya tiene un contrato técnico para recibir únicamente cuatro eventos
operativos: prueba confirmada, prueba terminada, inicio y nota útil de un
entrenador. El contrato excluye por diseño correo, teléfono, pago, tarifa,
conversaciones y diagnósticos. Está probado solo con datos ficticios y sigue
sin abrir ninguna conexión externa.

Antes del piloto real hay que verificar el destino y autenticación de uno de
los RestHooks/API existentes de WodBuster y autorizar una lectura individual
muy concreta. No se crea ni modifica una reserva, un pago, un nivel o una
ficha de WodBuster.
