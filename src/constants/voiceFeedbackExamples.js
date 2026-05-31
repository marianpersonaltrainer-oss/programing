/**
 * PACK DE VOZ — Feedbacks reales de Marian (Head Coach EVO).
 *
 * Estos son ejemplos REALES escritos por Marian, usados como few-shot para que la IA
 * imite su tono al generar/regenerar los feedbacks de coach (campos feedback_*).
 *
 * CÓMO AÑADIR MÁS: pega aquí más feedbacks reales tuyos, en prosa corrida (sin guiones).
 * Cuantos más y más variados (clases, días, registros corto/largo), mejor se replica la voz.
 * No hace falta tocar nada más: el prompt los lee de aquí automáticamente.
 */
export const VOICE_FEEDBACK_EXAMPLES = [
  'Hoy quiero que el KB Clean sea la prioridad, pero que la clase no se quede demasiado técnica. En el partner IGYG que se piquen un poco, pero sin perder la recepción del clean. El farmer hold tiene que picar. Si ves que alguien va muy justo, baja carga pero que siga moviéndose.',
  'El sled tiene que ser el protagonista, pero sin marearlos con demasiada explicación. Que prueben dos cargas y rápido a trabajar. En el team flow quiero que se muevan y se ayuden, no que uno haga todo. Si en el trineo bajan el ritmo, hay que bajar peso.',
  'Clase para sudar y disfrutar. Deja equipos claros desde el principio y controla que nadie se quede parado esperando máquina. Si solapan, cambia una estación a RUN y listo. En el finisher, que se animen entre ellos y acaben con sensación de equipo.',
  'Que se note el ambiente de partner relay. En la fuerza, carga exigente pero sin perder postura. En el WOD que salgan ordenados: uno trabaja, otro recupera, y cuando toca correr que aprieten.',
  'Hoy el RDL va con intención: bajada controlada y espalda fuerte. Pero en la parte B quiero que cambie la sensación, más atlética y menos de quedarse clavados en la barra. Los broad jumps y el bear crawl son los que van a darle vida al día. Que no se duerman entre bloques.',
  'En el hip thrust, que no se queden con el peso cómodo. Si al acabar la serie no notan glúteo, seguramente iban ligeros. En el for time, que empiecen con cabeza por los burpees. La carrera después de cada ronda es para soltar y seguir, que no se paren.',
  'Hoy es el día más técnico y controlado. No hace falta que salgan reventados, pero sí que trabajen bien. En el strict press, que no compensen con la espalda. En el EMOM, si los nordic no salen, cambiarlos a glute bridge. La carrera del minuto 4 tiene que darle aire al bloque.',
  'En el complex, que no se vuelvan locos subiendo peso; quiero barra rápida y controlada. En el team chipper, que repartan bien desde el inicio.',
  'Hoy la clase tiene que sentirse especial desde que entran. Mucho ambiente de equipo, ritmo constante y cabeza al principio: que no se vuelvan locos en las primeras rondas porque luego el volumen pasa factura. En las flexiones, mejor partir desde el principio o adaptar desde el inicio para que no lleguen al fallo.',
  'Buscar bien el trabajo de la parte A para que puedan mantenerlo las 4 series. En la parte B que se apreten: el paso del oso es exigente porque son bastantes metros, así que organiza los cajones al fondo y deja media sala para hacerlo.',
  'Se tienen que apretar en el for time, una sola ronda.',
  'En la parte A, retarles con el trabajo de pino. Ojo con los wall walks de la B: que los hagan de uno en uno y solo el mejor, sobre todo los que van muy justos.',
  // Variantes alternativas de los mismos días (otro fraseo, misma voz)
  'Hoy quiero que el KB Clean se vea limpio, pero que la clase no se quede demasiado técnica. En el partner IGYG que se piquen un poco, pero sin perder la recepción del clean. El farmer hold tiene que molestar, no ser relleno. Si ves que alguien va muy justo, baja carga y que siga moviéndose.',
  'El sled tiene que ser el protagonista, pero sin marearlos con demasiada explicación. Que prueben dos cargas y rápido a trabajar. En el team flow quiero que se muevan y se ayuden, no que uno haga todo y los demás miren. Si se atasca el trineo, baja peso y seguimos.',
  'Clase para sudar y disfrutar. Deja equipos claros desde el principio y controla que nadie se quede parado esperando máquina. Si hay atasco, cambia una estación a RUN y listo. En el finisher, que se animen entre ellos y acaben con sensación de equipo.',
  'Este es el día más memorable de la semana. Quiero que se note el ambiente de partner relay. En la fuerza, carga real pero sin romper postura. En el WOD que salgan ordenados: uno trabaja, otro recupera, y cuando toca correr se corre de verdad. Mucha energía aquí.',
  'Hoy el RDL va con intención: bajada controlada y espalda fuerte. Pero en la parte B quiero que cambie la sensación, más atlética y menos de quedarse clavados en la barra. Los broad jumps y el bear crawl son los que van a darle vida al día. Que no se duerman entre bloques.',
  'En el hip thrust, que no se queden con el peso cómodo. Si al acabar la serie no notan glúteo, seguramente iban ligeros. En el for time, que empiecen con cabeza porque los burpees se pagan rápido. La carrera después de cada ronda es para soltar y seguir, no para pasear.',
  'Hoy es el día más técnico y controlado. No hace falta que salgan reventados, pero sí que trabajen bien. En el strict press, que no compensen con la espalda. En el EMOM, si los nordic no salen, cambia rápido a glute bridge y no pierdas tiempo. La carrera del minuto 4 tiene que darle aire al bloque.',
  'Viernes tiene que sentirse como cierre de semana. En el complex, que no se vuelvan locos subiendo peso; quiero barra rápida y controlada. En el team chipper, que repartan bien desde el inicio. El bonus final es para acabar con risas y ambiente, pero que sigan trabajando.',
  'Hoy la clase tiene que sentirse especial desde que entran. Mucho ambiente de equipo, ritmo constante y cabeza al principio: que no se vuelvan locos en las primeras rondas porque luego el volumen pasa factura. En las flexiones, mejor partir pronto o adaptar desde el inicio para que no lleguen al fallo.',
  'Buscar bien el trabajo de la parte A para que puedan mantenerlo las 4 series. En la parte B que se apreten: el paso del oso es exigente porque son bastantes metros, así que organiza los cajones al fondo y deja media sala para hacerlo.',
]

/**
 * Bloque few-shot listo para inyectar en un prompt.
 * @param {number} [max] límite opcional de ejemplos (por defecto, todos).
 */
export function buildVoiceFewShot(max) {
  const list = typeof max === 'number' ? VOICE_FEEDBACK_EXAMPLES.slice(0, max) : VOICE_FEEDBACK_EXAMPLES
  return list.map((ex) => `· ${ex}`).join('\n')
}

export const VOICE_FEEDBACK_FEWSHOT = buildVoiceFewShot()
