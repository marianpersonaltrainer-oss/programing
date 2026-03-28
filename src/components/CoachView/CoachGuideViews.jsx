import {
  COACH_GUIDE_INTRO_BLURB,
  COACH_CENTRO_PARAS,
  COACH_CENTRO_EXPECT,
  COACH_CLASS_CARDS,
  COACH_CLASSES_FOOTNOTE,
  COACH_MESOCICLO_INTRO,
  COACH_MESOCICLO_ROWS,
  COACH_MESOCICLO_COACH,
  COACH_MESOCICLO_FUERZA_TITLE,
  COACH_MESOCICLO_AUTOCARGA_SUB,
  COACH_MESOCICLO_AUTOCARGA_ROWS,
  COACH_MESOCICLO_FBB_TITLE,
  COACH_MESOCICLO_FBB_SUB,
  COACH_MESOCICLO_FBB_ROWS,
  COACH_PROGRESSION_PRINCIPLE_TITLE,
  COACH_PROGRESSION_PRINCIPLE_LINES,
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
import { coachUi, coachText, coachBorder, coachBg, CLASS_BAR_HEX } from './coachTheme.js'

function MesoTable({ columns, rows, rowKey }) {
  return (
    <div className={`${coachUi.tableWrap} my-6`}>
      <table className="w-full text-left text-[14px] min-w-[280px]">
        <thead>
          <tr className={coachUi.tableHead}>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 font-bold uppercase tracking-wide text-[12px]">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r)} className={`border-t ${coachBorder} ${i % 2 === 0 ? coachBg.rowA : coachBg.rowB}`}>
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 ${coachText.primary}`}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CoachGuideScroll({ children, className = '' }) {
  return (
    <div className={`${coachUi.scroll} pb-24 ${className}`}>
      {children}
    </div>
  )
}

export function CoachGuideCentro() {
  return (
    <CoachGuideScroll>
      <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${coachText.accent}`}>
        Guía de referencia · ProgramingEvo · EVO Granada
      </p>
      <div className={`${coachUi.prose} ${coachText.muted} pb-4`}>
        {COACH_GUIDE_INTRO_BLURB.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <h2 className={coachUi.h2}>1. El centro — Quiénes somos</h2>
      <div className={`${coachUi.prose} space-y-6`}>
        {COACH_CENTRO_PARAS.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className={`${coachUi.card} space-y-4`}>
          <p className="font-bold text-[16px]">Lo que esperamos de cada clase</p>
          <ul className={`list-disc pl-6 space-y-3 ${coachText.muted}`}>
            {COACH_CENTRO_EXPECT.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </CoachGuideScroll>
  )
}

export function CoachGuideClases() {
  return (
    <CoachGuideScroll>
      <h2 className={coachUi.h2}>2. Las clases — Fichas de referencia</h2>
      <p className={`${coachUi.prose} ${coachText.muted} mb-8`}>
        EVO tiene cuatro tipos de clase activas. No son versiones escaladas unas de otras — cada una tiene un objetivo distinto, un público
        distinto y una estructura distinta. Conocerlas bien es fundamental.
      </p>
      <div className="space-y-8">
        {COACH_CLASS_CARDS.map((c) => {
          const bar = CLASS_BAR_HEX[c.id] || '#6A1F6D'
          return (
            <article
              key={c.id}
              className={`${coachUi.card} overflow-hidden pl-0 flex`}
              style={{ boxShadow: 'inset 4px 0 0 0 ' + bar }}
            >
              <div className="pl-5 space-y-3 flex-1">
                <div className="py-1 px-3 rounded-lg text-sm font-black uppercase tracking-tight inline-block" style={{ backgroundColor: `${bar}33`, color: '#E8EAF0' }}>
                  {c.title.split('—')[0].trim()}
                </div>
                <h3 className="text-[15px] font-bold text-[#E8EAF0] leading-snug">{c.title}</h3>
                <p className={`text-[15px] ${coachText.muted}`}>
                  <span className={`font-bold ${coachText.primary}`}>A quién va — </span>
                  {c.audience}
                </p>
                <p className={`text-[15px] ${coachText.muted}`}>
                  <span className={`font-bold ${coachText.primary}`}>Qué tiene — </span>
                  {c.has}
                </p>
                <p className={`text-[15px] ${coachText.muted} whitespace-pre-wrap`}>
                  <span className={`font-bold ${coachText.primary}`}>Estructura tipo — </span>
                  {c.structure}
                </p>
                <p className={`text-[15px] ${coachText.muted}`}>
                  <span className={`font-bold ${coachText.primary}`}>Lo que puede tener — </span>
                  {c.can}
                </p>
                <p className={`text-[15px] ${coachText.muted}`}>
                  <span className={`font-bold ${coachText.primary}`}>Lo que NO puede tener — </span>
                  {c.cannot}
                </p>
                {c.scale && (
                  <p className={`text-[15px] ${coachText.muted}`}>
                    <span className={`font-bold ${coachText.primary}`}>Escalado — </span>
                    {c.scale}
                  </p>
                )}
                <p className={`text-[15px] italic border-t ${coachBorder} pt-4 ${coachText.accent}`}>{c.feel}</p>
              </div>
            </article>
          )
        })}
      </div>
      <p className={`text-[15px] ${coachText.muted} mt-10 font-medium leading-relaxed`}>{COACH_CLASSES_FOOTNOTE}</p>
    </CoachGuideScroll>
  )
}

export function CoachGuideMesociclos() {
  return (
    <CoachGuideScroll>
      <h2 className={coachUi.h2}>3. Los mesociclos — Cómo funciona la progresión</h2>
      <div className={coachUi.prose}>
        {COACH_MESOCICLO_INTRO.map((p, i) => (
          <p key={i} className={i === 1 ? 'font-bold text-[16px] mt-8' : ''}>
            {p}
          </p>
        ))}
      </div>

      <h3 className={coachUi.h3}>{COACH_MESOCICLO_FUERZA_TITLE}</h3>
      <MesoTable
        columns={[
          { key: 'semana', label: 'Semana' },
          { key: 'fase', label: 'Fase' },
          { key: 'intensidad', label: 'Intensidad' },
          { key: 'notas', label: 'Qué notas en clase' },
        ]}
        rows={COACH_MESOCICLO_ROWS}
        rowKey={(r) => r.semana}
      />
      <h3 className="text-base font-bold mt-10 mb-3 text-[#E8EAF0]">{COACH_MESOCICLO_COACH[0]}</h3>
      <ul className={`list-disc pl-6 space-y-3 text-[15px] ${coachText.muted}`}>
        {COACH_MESOCICLO_COACH.slice(1).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>

      <div className={`${coachUi.card} mt-10 space-y-4`}>
        <h3 className="text-base font-extrabold uppercase tracking-wide text-[#E8EAF0]">Mesociclo de autocarga / bodyweight</h3>
        <p className={`text-[15px] ${coachText.accent} font-semibold`}>{COACH_MESOCICLO_AUTOCARGA_SUB}</p>
        <MesoTable
          columns={[
            { key: 'semana', label: 'Semana' },
            { key: 'fase', label: 'Fase' },
            { key: 'notas', label: 'Enfoque' },
          ]}
          rows={COACH_MESOCICLO_AUTOCARGA_ROWS}
          rowKey={(r) => `ac-${r.semana}`}
        />
      </div>

      <div className={`${coachUi.card} mt-10 space-y-4`}>
        <h3 className="text-base font-extrabold uppercase tracking-wide text-[#E8EAF0]">{COACH_MESOCICLO_FBB_TITLE}</h3>
        <p className={`text-[15px] ${coachText.muted}`}>{COACH_MESOCICLO_FBB_SUB}</p>
        <MesoTable
          columns={[
            { key: 'semana', label: 'Semana' },
            { key: 'rir', label: 'RIR' },
            { key: 'notas', label: 'Enfoque' },
          ]}
          rows={COACH_MESOCICLO_FBB_ROWS}
          rowKey={(r) => `fbb-${r.semana}`}
        />
      </div>

      <div className={`${coachUi.card} mt-10 space-y-4`}>
        <h3 className="text-base font-extrabold uppercase tracking-wide text-[#E8EAF0]">{COACH_PROGRESSION_PRINCIPLE_TITLE}</h3>
        <ul className={`list-disc pl-6 space-y-3 text-[15px] ${coachText.primary}`}>
          {COACH_PROGRESSION_PRINCIPLE_LINES.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </CoachGuideScroll>
  )
}

export function CoachGuideUsoApp() {
  return (
    <CoachGuideScroll>
      <h2 className={coachUi.h2}>4. Cómo usar la programación</h2>
      <p className={`text-[15px] ${coachText.muted} mb-8 leading-relaxed`}>
        La app genera la programación semanal de EVO. Cada sesión ya viene con todo lo que necesitas para dar la clase. Aquí te explicamos cómo
        leerla y qué hacer con ella.
      </p>
      {COACH_USO_SECTIONS.map((sec) => (
        <section key={sec.h} className={`mb-10 ${coachUi.card}`}>
          <h3 className="text-base font-bold mb-4 text-[#E8EAF0]">{sec.h}</h3>
          <div className={`text-[15px] space-y-3 leading-relaxed whitespace-pre-wrap ${coachText.muted}`}>
            {sec.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </section>
      ))}
    </CoachGuideScroll>
  )
}

export function CoachGuideMaterial({ guideSettings }) {
  const override = guideSettings?.material_override?.trim()

  return (
    <CoachGuideScroll>
      <h2 className={coachUi.h2}>5. Material disponible</h2>
      <p className={`text-[15px] ${coachText.muted} mb-8 leading-relaxed`}>{COACH_MATERIAL_INTRO}</p>
      {override ? (
        <div className={`${coachUi.card} border-emerald-900/40 bg-[#0f1729]`}>
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Contenido desde Supabase (material_override)</p>
          <pre className={`text-[15px] whitespace-pre-wrap font-sans leading-relaxed ${coachText.primary}`}>{override}</pre>
        </div>
      ) : (
        <>
          <h3 className={coachUi.h3}>Las dos salas</h3>
          <div className={`${coachUi.tableWrap} mb-8`}>
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className={coachUi.tableHead}>
                  <th className="px-4 py-3 font-bold uppercase text-[12px]">Sala</th>
                  <th className="px-4 py-3 font-bold uppercase text-[12px]">Contenido y prioridad</th>
                </tr>
              </thead>
              <tbody>
                {COACH_MATERIAL_ROOMS.map((r, i) => (
                  <tr key={r.sala} className={`border-t ${coachBorder} ${i % 2 === 0 ? coachBg.rowA : coachBg.rowB}`}>
                    <td className={`px-4 py-3 font-bold ${coachText.primary}`}>{r.sala}</td>
                    <td className={`px-4 py-3 ${coachText.muted}`}>{r.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className={coachUi.h3}>Inventario de material</h3>
          <div className="space-y-6">
            {COACH_MATERIAL_ITEMS.map((item) => (
              <div key={item.name} className={coachUi.card}>
                <p className="text-sm font-bold uppercase tracking-wide mb-2 text-[#9B3FA0]">{item.name}</p>
                <pre className={`text-[15px] whitespace-pre-wrap font-sans leading-relaxed ${coachText.muted}`}>{item.detail}</pre>
              </div>
            ))}
          </div>
        </>
      )}
    </CoachGuideScroll>
  )
}

export function CoachGuideSoporteProtocol({ guideSettings, variant = 'full' }) {
  const ch = guideSettings?.contact_channel?.trim()
  const rt = guideSettings?.contact_response?.trim()

  const inner = (
    <>
      <h2 className={variant === 'compact' ? 'text-base font-extrabold uppercase tracking-wide border-b border-[#2A3042] pb-2 mb-3 text-[#E8EAF0]' : coachUi.h2}>
        6. Soporte — Cómo preguntar dudas
      </h2>
      <p className={`text-[15px] ${coachText.muted} mb-6 leading-relaxed`}>{COACH_SOPORTE_INTRO}</p>
      <h3 className={variant === 'compact' ? 'text-sm font-bold mt-4 mb-2 text-[#E8EAF0]' : coachUi.h3}>Qué tipo de dudas van por soporte</h3>
      <ul className={`list-disc pl-6 space-y-2 text-[15px] ${coachText.muted} mb-6`}>
        {COACH_SOPORTE_SI.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <h3 className={variant === 'compact' ? 'text-sm font-bold mt-4 mb-2 text-[#E8EAF0]' : coachUi.h3}>Qué NO va por soporte</h3>
      <ul className={`list-disc pl-6 space-y-2 text-[15px] ${coachText.muted} mb-6`}>
        {COACH_SOPORTE_NO.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <h3 className={variant === 'compact' ? 'text-sm font-bold mt-4 mb-2 text-[#E8EAF0]' : coachUi.h3}>Canal y persona de contacto</h3>
      {ch ? (
        <p className={`text-[15px] whitespace-pre-wrap leading-relaxed rounded-xl border ${coachBorder} ${coachBg.card} p-4 ${coachText.primary}`}>{ch}</p>
      ) : (
        <p className="text-[14px] text-amber-200 bg-amber-950/40 border border-amber-800/50 rounded-xl p-4 leading-relaxed">
          {COACH_SOPORTE_PLACEHOLDER_CHANNEL}
          <span className={`block mt-3 text-xs font-bold uppercase tracking-wide text-amber-400/90`}>
            Edita contact_channel y contact_response en Supabase → coach_guide_settings (fila default).
          </span>
        </p>
      )}
      <h3 className={variant === 'compact' ? 'text-sm font-bold mt-4 mb-2 text-[#E8EAF0]' : coachUi.h3}>Tiempo de respuesta esperado</h3>
      {rt ? (
        <p className={`text-[15px] whitespace-pre-wrap leading-relaxed rounded-xl border ${coachBorder} ${coachBg.card} p-4 ${coachText.primary}`}>{rt}</p>
      ) : (
        <p className="text-[14px] text-amber-200 bg-amber-950/40 border border-amber-800/50 rounded-xl p-4 leading-relaxed">{COACH_SOPORTE_PLACEHOLDER_RESPONSE}</p>
      )}
      <p className={`text-xs ${coachText.muted} font-bold uppercase tracking-widest mt-10 text-center`}>{COACH_SOPORTE_FOOTER}</p>
    </>
  )

  if (variant === 'compact') {
    return <div className="px-6 py-5 space-y-3">{inner}</div>
  }

  return <CoachGuideScroll className="pb-8">{inner}</CoachGuideScroll>
}
