/**
 * Borrador interno del método EVO aportado por Marian.
 * No diagnostica, no guarda información de personas y no genera cambios
 * automáticos en una clase. Antes de usarlo con casos reales requiere la
 * revisión y publicación expresa del Head Coach.
 */
export const HEAD_COACH_ADAPTATION_DRAFT = Object.freeze({
  status: 'borrador_interno',
  principle: 'Mantener el objetivo de la clase, adaptando para que la persona pueda entrenar sin dolor.',
  boundaries: [
    'No diagnosticar ni prometer recuperación. Si el dolor es demasiado alto, la persona no puede moverse o la adaptación no lo resuelve, se para y se consulta al equipo responsable.',
    'No usar este borrador para sustituir indicaciones sanitarias ni para decidir sobre una lesión grave o una recaída con inflamación.',
    'Un cambio individual no se publica ni se añade al historial desde esta pantalla.',
  ],
  sections: [
    {
      id: 'lumbar',
      title: 'Lumbar · opciones EVO por validar',
      purpose: 'Mantener trabajo general sin flexión, carga lumbar excesiva ni impacto si provocan dolor.',
      options: [
        'Zona 2 en bicicleta por calorías.',
        'Sentadilla isométrica, puente de glúteo con carga que no moleste y zancadas sin peso o con carga ligera progresiva si no hay molestia.',
        'Dead bug o sentadilla a cajón cuando no provoquen dolor.',
      ],
    },
    {
      id: 'rodilla',
      title: 'Rodilla · opciones EVO por validar',
      purpose: 'Conservar el estímulo sin forzar el rango ni el impacto que provoque dolor.',
      options: [
        'Trabajo isométrico como wall sit.',
        'Puente de glúteo, trabajo de isquios y gomas.',
        'Limitar rango o retirar impacto si ese es el desencadenante y se mantiene sin dolor.',
      ],
    },
    {
      id: 'hombro_muneca_cuello',
      title: 'Hombro, muñeca y cuello · protocolo aún incompleto',
      purpose: 'No improvisar una pauta cerrada: registrar la duda general y pedir revisión antes de consolidarla.',
      options: [
        'Hombro: landmine como posible alternativa a validar.',
        'Muñeca: apoyos paralelos; bajar o retirar la carga de front squat; cambiar barra por mancuerna cuando sea apropiado.',
        'Cuello: parar y consultar antes de decidir una alternativa estándar.',
      ],
    },
  ],
  reviewRecord: [
    'Ejercicio original y alternativa propuesta.',
    'Motivo general y qué ocurrió en la sesión, sin diagnóstico ni datos clínicos.',
    'Solo consolidar una pauta cuando se revise y apruebe como método EVO.',
  ],
  contributionFlow: [
    {
      role: 'Coach',
      action: 'Comparte una observación general de clase o una duda de método, sin nombres ni información clínica.',
    },
    {
      role: 'Head Coach',
      action: 'Agrupa patrones repetidos y prepara un borrador de regla; no modifica programación ni decide un caso individual.',
    },
    {
      role: 'Marian',
      action: 'Revisa y aprueba, corrige o descarta cada regla antes de que pase a ser método EVO.',
    },
    {
      role: 'Agente programador',
      action: 'Recibe solo las reglas aprobadas que afecten a la programación; nunca el historial personal de alguien.',
    },
  ],
})
