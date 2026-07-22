/**
 * Ejemplos de voz curados para el feedback que Marian deja al entrenador.
 *
 * Enseñan forma y criterio, no contenido obligatorio: primero explican qué se
 * busca en la sesión y cómo debería sentirse; después añaden solo la decisión
 * práctica que de verdad cambia la clase.
 */
export const VOICE_FEEDBACK_EXAMPLES = [
  'Hoy buscamos una fuerza sólida, sin perseguir una marca ni llegar al fallo. En los intervalos sí quiero que suban el ritmo, pero con un peso que les permita mantener el movimiento limpio desde la primera ronda hasta la última. Si el wall ball empieza a romperse demasiado pronto, bajad carga antes de que el bloque pierda continuidad.',
  'La idea de hoy en Basics es que entiendan bien la posición y ganen confianza con la barra. No hace falta correr con las cargas: prefiero que repitan bien y que lleguen al bloque final sabiendo qué están haciendo. Organizad parejas por niveles parecidos para que los cambios sean rápidos y nadie se quede esperando.',
  'En Fit hoy quiero una sesión de fuerza de verdad, con un peso que resulte exigente pero que puedan sostener en todas las series. Los accesorios deben completar el trabajo principal y el WOD tiene que cambiar la sensación, con más ritmo y sin volver a cargar la misma zona. Quien ya tenga dominada estricta puede hacerla; el resto trabaja Ring Row sin convertirlo en un skill.',
  'Hoy buscamos un trabajo continuo y bien medido, no salir demasiado rápido y quedarse sin ritmo a mitad de la sesión. Dejad las cinco estaciones montadas desde el principio y explicad una sola dirección de cambio para que el grupo fluya. Si se forma espera en una máquina, reducid el tiempo de uso antes de cambiar toda la estructura.',
  'La gracia de esta sesión está en el trabajo por parejas: queremos que se ayuden a mantener el ritmo, no que una persona termine haciendo casi todo. En la primera vuelta que prueben el reparto y, a partir de ahí, que ajusten las tandas antes de llegar al fallo. Dejad claro desde el inicio si el cambio es por ronda para evitar dudas durante el WOD.',
  'Hoy el trabajo técnico es la prioridad, pero la clase no debe quedarse parada explicando demasiado. Quiero pocas correcciones, muy claras, y repeticiones de calidad que puedan repetir con confianza. En el bloque final, la opción de acceso y la de capacidad deben quedar decididas antes de empezar para que cada persona pueda trabajar con continuidad.',
  'Buscamos que el trineo sea el protagonista y que el esfuerzo se vea fuerte, pero sin que la carga bloquee la estación. Dejad que prueben dos pesos durante la preparación y elegid el que les permita moverse sin paradas largas. Si una pareja empieza a tardar mucho más que las demás, bajad carga y mantened el orden de salida.',
  'Hoy quiero que la primera parte se vea controlada y que el cierre tenga una sensación más atlética y ligera. No hace falta repetir cada bloque en el feedback: lo importante es que el entrenador entienda el cambio de intención entre uno y otro. Dejad preparado el espacio de desplazamiento antes de empezar para no cortar el ritmo cuando llegue esa parte.',
]

/**
 * Bloque few-shot listo para inyectar en un prompt.
 * @param {number} [max] límite opcional de ejemplos (por defecto, todos).
 */
export function buildVoiceFewShot(max) {
  const list = typeof max === 'number' ? VOICE_FEEDBACK_EXAMPLES.slice(0, max) : VOICE_FEEDBACK_EXAMPLES
  return list.map((example) => `· ${example}`).join('\n')
}

export const VOICE_FEEDBACK_FEWSHOT = buildVoiceFewShot()
