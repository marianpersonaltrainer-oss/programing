import {
  COACH_GUIDE_INTRO_BLURB,
  COACH_CENTRO_PARAS,
  COACH_CENTRO_EXPECT,
  COACH_CLASS_CARDS,
  COACH_CLASSES_FOOTNOTE,
  COACH_MESOCICLO_INTRO,
  COACH_MESOCICLO_ROWS,
  COACH_MESOCICLO_COACH,
  COACH_USO_SECTIONS,
  COACH_MATERIAL_INTRO,
  COACH_MATERIAL_ROOMS,
  COACH_MATERIAL_ITEMS,
  COACH_SOPORTE_INTRO,
  COACH_SOPORTE_SI,
  COACH_SOPORTE_NO,
  COACH_SOPORTE_PLACEHOLDER_CHANNEL,
  COACH_SOPORTE_PLACEHOLDER_RESPONSE,
  COACH_SOPORTE_FOOTER,
} from '../../data/coachGuideContent.js'

const prose = 'text-[13px] text-gray-700 leading-relaxed space-y-4'
const h2 = 'text-[11px] font-bold text-evo-text uppercase tracking-widest border-b border-black/10 pb-2'
const h3 = 'text-[12px] font-bold text-evo-text mt-6 mb-2'

export function CoachGuideScroll({ children, className = '' }) {
  return (
    <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 pb-28 ${className}`}>
      {children}
    </div>
  )
}

export function CoachGuideCentro() {
  return (
    <CoachGuideScroll>
      <p className="text-[10px] font-bold text-evo-accent uppercase tracking-widest">Guía de referencia · ProgramingEvo · EVO Granada</p>
      <div className={`${prose} text-[12px] pb-2`}>
        {COACH_GUIDE_INTRO_BLURB.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <h2 className={h2}>1. El centro — Quiénes somos</h2>
      <div className={prose}>
        {COACH_CENTRO_PARAS.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="font-bold text-evo-text">Lo que esperamos de cada clase</p>
        <ul className="list-disc pl-5 space-y-2">
          {COACH_CENTRO_EXPECT.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </CoachGuideScroll>
  )
}

export function CoachGuideClases() {
  return (
    <CoachGuideScroll>
      <h2 className={h2}>2. Las clases — Fichas de referencia</h2>
      <p className={`${prose} text-[12px] mb-4`}>
        EVO tiene cuatro tipos de clase activas. No son versiones escaladas unas de otras — cada una tiene un objetivo distinto, un público
        distinto y una estructura distinta. Conocerlas bien es fundamental.
      </p>
      <div className="space-y-5">
        {COACH_CLASS_CARDS.map((c) => (
          <article key={c.id} className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm space-y-2">
            <h3 className="text-[12px] font-black text-evo-text uppercase tracking-tight">{c.title}</h3>
            <p className="text-[11px] text-gray-600">
              <span className="font-bold text-evo-text">A quién va — </span>
              {c.audience}
            </p>
            <p className="text-[11px] text-gray-600">
              <span className="font-bold text-evo-text">Qué tiene — </span>
              {c.has}
            </p>
            <p className="text-[11px] text-gray-600 whitespace-pre-wrap">
              <span className="font-bold text-evo-text">Estructura tipo — </span>
              {c.structure}
            </p>
            <p className="text-[11px] text-gray-600">
              <span className="font-bold text-evo-text">Lo que puede tener — </span>
              {c.can}
            </p>
            <p className="text-[11px] text-gray-600">
              <span className="font-bold text-evo-text">Lo que NO puede tener — </span>
              {c.cannot}
            </p>
            {c.scale && (
              <p className="text-[11px] text-gray-600">
                <span className="font-bold text-evo-text">Escalado — </span>
                {c.scale}
              </p>
            )}
            <p className="text-[11px] text-evo-accent/90 font-medium italic border-t border-black/5 pt-2">{c.feel}</p>
          </article>
        ))}
      </div>
      <p className="text-[11px] text-gray-600 mt-6 font-medium leading-relaxed">{COACH_CLASSES_FOOTNOTE}</p>
    </CoachGuideScroll>
  )
}

export function CoachGuideMesociclos() {
  return (
    <CoachGuideScroll>
      <h2 className={h2}>3. Los mesociclos — Cómo funciona la progresión</h2>
      <div className={prose}>
        {COACH_MESOCICLO_INTRO.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-black/10 my-4">
        <table className="w-full text-left text-[11px] min-w-[280px]">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="px-3 py-2 font-bold uppercase tracking-wide">Semana</th>
              <th className="px-3 py-2 font-bold uppercase tracking-wide">Fase</th>
              <th className="px-3 py-2 font-bold uppercase tracking-wide">Intensidad</th>
              <th className="px-3 py-2 font-bold uppercase tracking-wide">Qué notas en clase</th>
            </tr>
          </thead>
          <tbody>
            {COACH_MESOCICLO_ROWS.map((r) => (
              <tr key={r.semana} className="border-t border-black/8 odd:bg-gray-50/80">
                <td className="px-3 py-2 font-bold text-evo-accent">{r.semana}</td>
                <td className="px-3 py-2 font-semibold text-evo-text">{r.fase}</td>
                <td className="px-3 py-2">{r.intensidad}</td>
                <td className="px-3 py-2 text-gray-700">{r.notas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className={h3}>{COACH_MESOCICLO_COACH[0]}</h3>
      <ul className="list-disc pl-5 space-y-2 text-[13px] text-gray-700">
        {COACH_MESOCICLO_COACH.slice(1).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </CoachGuideScroll>
  )
}

export function CoachGuideUsoApp() {
  return (
    <CoachGuideScroll>
      <h2 className={h2}>4. Cómo usar la programación</h2>
      <p className="text-[12px] text-gray-700 mb-4 leading-relaxed">
        La app genera la programación semanal de EVO. Cada sesión ya viene con todo lo que necesitas para dar la clase. Aquí te explicamos cómo
        leerla y qué hacer con ella.
      </p>
      {COACH_USO_SECTIONS.map((sec) => (
        <section key={sec.h} className="mb-6">
          <h3 className={h3}>{sec.h}</h3>
          <div className="text-[12px] text-gray-700 space-y-2 leading-relaxed whitespace-pre-wrap">{sec.lines.map((line, i) => <p key={i}>{line}</p>)}</div>
        </section>
      ))}
    </CoachGuideScroll>
  )
}

export function CoachGuideMaterial({ guideSettings }) {
  const override = guideSettings?.material_override?.trim()

  return (
    <CoachGuideScroll>
      <h2 className={h2}>5. Material disponible</h2>
      <p className="text-[12px] text-gray-700 mb-4 leading-relaxed">{COACH_MATERIAL_INTRO}</p>
      {override ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest mb-2">Contenido desde Supabase (coach_guide_settings.material_override)</p>
          <pre className="text-[12px] text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{override}</pre>
        </div>
      ) : (
        <>
          <h3 className={h3}>Las dos salas</h3>
          <div className="overflow-x-auto rounded-xl border border-black/10 mb-4">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 font-bold uppercase">Sala</th>
                  <th className="px-3 py-2 font-bold uppercase">Contenido y prioridad</th>
                </tr>
              </thead>
              <tbody>
                {COACH_MATERIAL_ROOMS.map((r) => (
                  <tr key={r.sala} className="border-t border-black/8">
                    <td className="px-3 py-2 font-bold text-evo-text">{r.sala}</td>
                    <td className="px-3 py-2 text-gray-700">{r.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className={h3}>Inventario de material</h3>
          <div className="space-y-3">
            {COACH_MATERIAL_ITEMS.map((item) => (
              <div key={item.name} className="rounded-xl border border-black/8 bg-white p-3 shadow-sm">
                <p className="text-[11px] font-bold text-evo-text uppercase tracking-wide mb-1">{item.name}</p>
                <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{item.detail}</pre>
              </div>
            ))}
          </div>
        </>
      )}
    </CoachGuideScroll>
  )
}

/** Solo texto de protocolo (el chat va aparte en CoachView). variant=compact: cabecera fija encima del chat. */
export function CoachGuideSoporteProtocol({ guideSettings, variant = 'full' }) {
  const ch = guideSettings?.contact_channel?.trim()
  const rt = guideSettings?.contact_response?.trim()

  const inner = (
    <>
      <h2 className={h2}>6. Soporte — Cómo preguntar dudas</h2>
      <p className="text-[12px] text-gray-700 mb-4 leading-relaxed">{COACH_SOPORTE_INTRO}</p>
      <h3 className={h3}>Qué tipo de dudas van por soporte</h3>
      <ul className="list-disc pl-5 space-y-1.5 text-[12px] text-gray-700 mb-4">
        {COACH_SOPORTE_SI.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <h3 className={h3}>Qué NO va por soporte</h3>
      <ul className="list-disc pl-5 space-y-1.5 text-[12px] text-gray-700 mb-4">
        {COACH_SOPORTE_NO.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <h3 className={h3}>Canal y persona de contacto</h3>
      {ch ? (
        <p className="text-[12px] text-gray-800 whitespace-pre-wrap leading-relaxed rounded-xl bg-violet-50 border border-violet-100 p-4">{ch}</p>
      ) : (
        <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-xl p-4 leading-relaxed">
          {COACH_SOPORTE_PLACEHOLDER_CHANNEL}
          <span className="block mt-2 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            Edita las columnas contact_channel y contact_response en Supabase → coach_guide_settings (fila default).
          </span>
        </p>
      )}
      <h3 className={h3}>Tiempo de respuesta esperado</h3>
      {rt ? (
        <p className="text-[12px] text-gray-800 whitespace-pre-wrap leading-relaxed rounded-xl bg-violet-50 border border-violet-100 p-4">{rt}</p>
      ) : (
        <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-xl p-4 leading-relaxed">{COACH_SOPORTE_PLACEHOLDER_RESPONSE}</p>
      )}
      <p className="text-[9px] text-evo-muted font-bold uppercase tracking-widest mt-8 text-center">{COACH_SOPORTE_FOOTER}</p>
    </>
  )

  if (variant === 'compact') {
    return <div className="px-5 py-4 space-y-3">{inner}</div>
  }

  return <CoachGuideScroll className="pb-4">{inner}</CoachGuideScroll>
}
