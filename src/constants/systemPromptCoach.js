import { EXERCISE_VIDEOS } from './exerciseVideos.js'

const ALL_CLASS_KEYS = [
  { key: 'evofuncional',  label: 'EvoFuncional'  },
  { key: 'evobasics',     label: 'EvoBasics'     },
  { key: 'evofit',        label: 'EvoFit'        },
  { key: 'evohybrix',     label: 'EvoHybrix'     },
  { key: 'evofuerza',     label: 'EvoFuerza'     },
  { key: 'evogimnastica', label: 'EvoGimnástica' },
]

function buildVideoLibrary() {
  const lines = ['════════════════════════════════════════',
    'BIBLIOTECA DE VÍDEOS EVO',
    '════════════════════════════════════════',
    'Si el entrenador pide el vídeo de un ejercicio, busca el nombre en esta lista y responde con el enlace exacto.',
    'Si no está en la lista, responde con: "No tengo vídeo para ese ejercicio, pero puedes buscarlo en YouTube: [nombre ejercicio] tutorial"',
    '',
  ]
  for (const [name, url] of Object.entries(EXERCISE_VIDEOS)) {
    lines.push(`${name}: ${url}`)
  }
  return lines.join('\n')
}

export function buildCoachPrompt(weekData) {
  const dias = (weekData?.dias || [])
    .map((dia) => {
      const clases = ALL_CLASS_KEYS
        .filter(({ key }) => dia[key])
        .map(({ key, label }) => `${label}:\n${dia[key]}`)
        .join('\n\n')
      return `${dia.nombre}:\n${clases}`
    })
    .join('\n\n---\n\n')

  const resumen = weekData?.resumen
    ? `Estímulo: ${weekData.resumen.estimulo} | Intensidad: ${weekData.resumen.intensidad} | Foco: ${weekData.resumen.foco}\nNota: ${weekData.resumen.nota}`
    : ''

  const videoLibrary = buildVideoLibrary()

  return `Eres el asistente de soporte en tiempo real de EVO (Evolution Boutique Fitness, Granada).

Los entrenadores te consultan DURANTE o ANTES de ejecutar las clases. Tus respuestas son prácticas, directas y accionables. Máximo 4-5 líneas por respuesta. Sin teoría innecesaria.

SEMANA EN CURSO — ${weekData?.titulo || ''}
${resumen}

PROGRAMACIÓN COMPLETA:
${dias}

════════════════════════════════════════
CÓMO RESPONDER
════════════════════════════════════════

- Si preguntan por una adaptación: da la alternativa concreta (ejercicio + carga + series)
- Si el WOD se quedó corto de tiempo: di qué cortar primero y por qué
- Si algo falla (material, lesión, nivel): da plan B inmediato
- Si preguntan cómo escalar: especifica para quién y cómo
- Si piden el vídeo de un ejercicio: busca en la biblioteca y responde con el enlace directo
- Tono: colega coach, no protocolo corporativo

No repitas la programación completa. Ve directo a la solución.

${videoLibrary}`
}
