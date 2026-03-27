// Biblioteca de vídeos de ejercicios EVO
// Usa YouTube search URLs para que nunca se rompan
// Añade o edita ejercicios aquí según necesites

const YT = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`

export const EXERCISE_VIDEOS = {

  // ── CALENTAMIENTO & MOVILIDAD ─────────────────────────────────────────────
  'cat camel':              YT('cat camel movilidad columna'),
  'cat cow':                YT('cat cow movilidad columna'),
  'world greatest stretch': YT('world greatest stretch tutorial'),
  'worlds greatest stretch':YT('world greatest stretch tutorial'),
  'inchworm':               YT('inchworm ejercicio calentamiento'),
  'cossack squat':          YT('cossack squat movilidad cadera'),
  'hip 90/90':              YT('hip 90 90 movilidad cadera'),
  '90/90':                  YT('hip 90 90 movilidad'),
  'scap push up':           YT('scap push up escapular'),
  'scap pushup':            YT('scap push up escapular'),
  'wall slide':             YT('wall slide hombro movilidad'),
  'band pull apart':        YT('band pull apart escapular'),
  'bear crawl':             YT('bear crawl ejercicio'),
  'hip circle':             YT('hip circle movilidad cadera'),
  'ankle mobility':         YT('ankle mobility tobillo movilidad'),
  'jefferson curl':         YT('jefferson curl cadena posterior'),
  'thoracic rotation':      YT('thoracic rotation movilidad torácica'),
  'dead bug':               YT('dead bug ejercicio core'),
  'hollow body hold':       YT('hollow body hold core'),
  'hollow rock':            YT('hollow rock gymnastics'),
  'hip transition':         YT('hip transition calentamiento'),
  '90/90 hip transition':   YT('90 90 hip transition movilidad'),
  'bottom squat hold':      YT('bottom squat hold movilidad tobillo'),
  'lateral lunge':          YT('lateral lunge calentamiento'),
  'reverse lunge':          YT('reverse lunge ejercicio'),
  'calf raise':             YT('calf raise pantorrilla'),
  'arm circle':             YT('arm circles hombro calentamiento'),

  // ── LANDMINE ─────────────────────────────────────────────────────────────
  'landmine clean':         YT('landmine clean tutorial'),
  'landmine thruster':      YT('landmine thruster tutorial'),
  'landmine rotational press': YT('landmine rotational press tutorial'),
  'landmine press':         YT('landmine press tutorial'),
  'landmine rdl':           YT('landmine rdl romanian deadlift'),
  'landmine goblet squat':  YT('landmine goblet squat tutorial'),
  'landmine squat':         YT('landmine squat tutorial'),
  'landmine meadows row':   YT('landmine meadows row tutorial'),
  'meadows row':            YT('meadows row espalda'),
  'landmine hip thrust':    YT('landmine hip thrust glúteo'),
  'landmine antirotation press': YT('landmine antirotation press pallof'),
  'landmine single leg rdl':YT('landmine single leg rdl tutorial'),

  // ── ACCESORIOS & CORE ────────────────────────────────────────────────────
  'copenhagen plank':       YT('copenhagen plank aductores tutorial'),
  'nordic curl':            YT('nordic curl isquiotibiales tutorial'),
  'pallof press':           YT('pallof press core antirotación'),
  'single leg rdl':         YT('single leg rdl romanian deadlift'),
  'spanish squat':          YT('spanish squat banda rodilla'),
  'banded face pull':       YT('face pull banda escapular'),
  'face pull':              YT('face pull cable mancuerna'),
  'banded lateral walk':    YT('banded lateral walk glúteo'),
  'lateral walk':           YT('lateral walk banda glúteo'),
  'hip thrust':             YT('hip thrust glúteo tutorial'),
  'glute bridge':           YT('glute bridge glúteo tutorial'),
  'lateral raise':          YT('lateral raise hombro mancuerna'),
  'rear delt fly':          YT('rear delt fly hombro posterior'),
  'rear delt':              YT('rear delt hombro posterior'),
  'tricep pushdown':        YT('tricep pushdown cable'),
  'triceps pushdown':       YT('tricep pushdown cable'),
  'skull crusher':          YT('skull crusher tríceps'),
  'barbell curl':           YT('barbell curl bíceps'),
  'hammer curl':            YT('hammer curl bíceps'),
  'reverse fly':            YT('reverse fly hombro posterior'),
  'romanian deadlift':      YT('romanian deadlift rdl bisagra'),
  'sumo deadlift':          YT('sumo deadlift técnica'),
  'jefferson deadlift':     YT('jefferson deadlift tutorial'),
  'deficit deadlift':       YT('deficit deadlift tutorial'),

  // ── KETTLEBELL ───────────────────────────────────────────────────────────
  'kb snatch':              YT('kettlebell snatch tutorial'),
  'kb clean':               YT('kettlebell clean tutorial'),
  'kb swing americano':     YT('kettlebell swing americano tutorial'),
  'kb swing ruso':          YT('kettlebell swing ruso tutorial'),
  'kb turkish get up':      YT('turkish get up kettlebell'),
  'turkish get up':         YT('turkish get up kettlebell'),
  'kb windmill':            YT('kettlebell windmill tutorial'),
  'kb goblet squat':        YT('kettlebell goblet squat tutorial'),
  'goblet squat':           YT('goblet squat tutorial'),
  'suitcase carry':         YT('suitcase carry farmer carry tutorial'),
  'waiter walk':            YT('waiter walk overhead carry tutorial'),
  'farmer carry':           YT('farmer carry tutorial'),

  // ── FUNCIONALES / GIMNÁSTICOS ─────────────────────────────────────────────
  'ring row':               YT('ring row TRX tutorial'),
  'ring dip':               YT('ring dip tutorial'),
  't2b':                    YT('toes to bar tutorial'),
  'toes to bar':            YT('toes to bar tutorial'),
  'hanging knee raise':     YT('hanging knee raise abdominales'),
  'ghd sit up':             YT('GHD sit up tutorial'),
  'box jump':               YT('box jump técnica aterrizaje'),
  'burpee box jump':        YT('burpee box jump tutorial'),
  'step up':                YT('step up box ejercicio'),
  'box step up':            YT('box step up tutorial'),
  'hspu':                   YT('handstand push up contra pared tutorial'),
  'handstand push up':      YT('handstand push up contra pared tutorial'),
  'kipping pull up':        YT('kipping pull up técnica'),
  'chest to bar':           YT('chest to bar pull up tutorial'),
  'c2b':                    YT('chest to bar pull up tutorial'),

  // ── OLÍMPICOS ─────────────────────────────────────────────────────────────
  'power clean':            YT('power clean técnica tutorial'),
  'hang power clean':       YT('hang power clean tutorial'),
  'hang clean':             YT('hang clean tutorial'),
  'power snatch':           YT('power snatch técnica tutorial'),
  'hang power snatch':      YT('hang power snatch tutorial'),
  'hang snatch':            YT('hang snatch tutorial'),
  'push jerk':              YT('push jerk técnica tutorial'),
  'split jerk':             YT('split jerk técnica tutorial'),
  'push press':             YT('push press técnica tutorial'),
  'thruster':               YT('thruster crossfit técnica'),
  'db thruster':            YT('dumbbell thruster tutorial'),
  'db snatch':              YT('dumbbell snatch tutorial'),
  'db hang snatch':         YT('dumbbell hang snatch tutorial'),
  'db clean':               YT('dumbbell clean tutorial'),
}

// Categorías para la Biblioteca
export const EXERCISE_CATEGORIES = {
  calentamiento: ['cat camel', 'cat cow', 'world greatest stretch', 'inchworm', 'cossack squat', 'hip 90/90', 'scap push up', 'wall slide', 'band pull apart', 'bear crawl', 'dead bug', 'hollow body hold', 'hollow rock', 'hip transition', 'bottom squat hold', 'lateral lunge'],
  landmine: ['landmine clean', 'landmine thruster', 'landmine rotational press', 'landmine press', 'landmine rdl', 'landmine goblet squat', 'landmine squat', 'landmine meadows row', 'meadows row', 'landmine hip thrust', 'landmine antirotation press'],
  accesorios: ['copenhagen plank', 'nordic curl', 'pallof press', 'single leg rdl', 'spanish squat', 'face pull', 'banded face pull', 'banded lateral walk', 'hip thrust', 'glute bridge', 'lateral raise', 'rear delt fly', 'skull crusher', 'barbell curl', 'hammer curl'],
  kettlebell: ['kb snatch', 'kb clean', 'kb swing americano', 'kb swing ruso', 'turkish get up', 'kb windmill', 'goblet squat', 'suitcase carry', 'waiter walk', 'farmer carry'],
  olimpicos: ['power clean', 'hang power clean', 'hang clean', 'power snatch', 'hang power snatch', 'push jerk', 'push press', 'thruster', 'db thruster', 'db snatch', 'db clean'],
}

// Busca ejercicios en un texto (case insensitive) y devuelve los que tienen vídeo
export function findExercisesWithVideos(text) {
  if (!text) return []
  const lowerText = text.toLowerCase()
  const found = []
  for (const [name, url] of Object.entries(EXERCISE_VIDEOS)) {
    if (lowerText.includes(name)) {
      // Evitar duplicados
      if (!found.find((f) => f.name === name)) {
        found.push({ name, url })
      }
    }
  }
  // Ordenar por longitud descendente para priorizar matches más específicos
  return found.sort((a, b) => b.name.length - a.name.length).slice(0, 8)
}
