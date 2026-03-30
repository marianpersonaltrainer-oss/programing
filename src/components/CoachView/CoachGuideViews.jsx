import {
  COACH_GUIDE_INTRO_BLURB,
  COACH_CENTRO_PARAS,
  COACH_CENTRO_VALUES,
  COACH_CENTRO_MISSION,
  COACH_CENTRO_TRANSMIT,
  COACH_CENTRO_EXPECT,
  COACH_CLASS_CARDS,
  COACH_CLASSES_FOOTNOTE,
  COACH_CLASS_DAY_COHERENCE,
  COACH_MESOCICLO_INTRO,
  COACH_MESOCICLO_ROWS,
  COACH_MESOCICLO_COACH,
  COACH_MESOCICLO_FUERZA_TITLE,
  COACH_MESOCICLO_AUTOCARGA_SUB,
  COACH_MESOCICLO_AUTOCARGA_ROWS,
  COACH_MESOCICLO_MIXTO_TITLE,
  COACH_MESOCICLO_MIXTO_ROWS,
  COACH_MESOCICLO_ESPECIALIDADES_TITLE,
  COACH_MESOCICLO_ESPECIALIDADES_PARAS,
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
import { coachUi, coachText, coachBorder, coachBg } from './coachTheme.js'
import { CLASS_BAR_HEX } from '../../constants/evoClasses.js'

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
      <h1 className="font-evo-display text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-[0.08em] text-[#6A1F6D] mb-3 leading-tight">
        Guía de referencia · ProgramingEvo · EVO Granada
      </h1>
      <div className={`${coachUi.prose} ${coachText.muted} pb-6`}>
        {COACH_GUIDE_INTRO_BLURB.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <h2 className={coachUi.h2}>1. El centro — Quiénes somos</h2>
      <div className={`${coachUi.prose} space-y-6`}>
        {COACH_CENTRO_PARAS.map((p, i) => (
          <p key={i} className={`text-base ${coachText.primary}`}>
            {p}
          </p>
        ))}

        <div
          className={`rounded-2xl border-2 border-[#6A1F6D]/40 px-6 py-6 space-y-4 ${coachBg.cardAlt}`}
        >
          <p className={`text-xs font-bold uppercase tracking-widest ${coachText.title}`}>Valores EVO</p>
          <p className="font-evo-display text-2xl sm:text-3xl font-bold text-[#6A1F6D] leading-snug">
            {COACH_CENTRO_VALUES}
          </p>
        </div>

        <div className={`rounded-2xl border ${coachBorder} ${coachBg.card} px-6 py-5 space-y-2`}>
          <p className={`text-xs font-bold uppercase tracking-widest ${coachText.title}`}>Misión</p>
          <p className={`text-lg sm:text-xl font-semibold leading-relaxed ${coachText.primary}`}>
            {COACH_CENTRO_MISSION}
          </p>
        </div>

        <div
          className={`rounded-2xl px-6 py-5 border-2 border-[#6A1F6D]/25`}
          style={{ backgroundColor: '#FFFF4C14' }}
        >
          <p className={`text-xs font-bold uppercase tracking-widest text-[#6A1F6D] mb-2`}>Lo que buscamos transmitir</p>
          <p className={`text-base sm:text-lg font-medium leading-relaxed ${coachText.primary}`}>
            {COACH_CENTRO_TRANSMIT}
          </p>
        </div>

        <div
          className={`rounded-2xl border-2 border-[#A729AD]/35 px-6 py-6 space-y-4 shadow-md ${coachBg.card}`}
        >
          <p className="font-evo-display text-lg sm:text-xl font-black uppercase tracking-wide text-[#6A1F6D]">
            Lo que esperamos de cada clase
          </p>
          <ul className={`list-none space-y-4 pl-0`}>
            {COACH_CENTRO_EXPECT.map((t, i) => (
              <li
                key={i}
                className={`flex gap-3 text-base sm:text-lg font-medium leading-snug ${coachText.primary}`}
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#6A1F6D] text-white flex items-center justify-center text-sm font-black font-evo-display">
                  {i + 1}
                </span>
                <span className="pt-0.5">{t}</span>
              </li>
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
      <p className={`${coachUi.prose} ${coachText.muted} mb-6`}>
        EVO tiene siete perfiles en la guía: cuatro son el núcleo diario; EvoFuerza, EvoGimnástica y EvoTodos solo aplican cuando la semana
        publicada o las instrucciones lo indican. No son versiones escaladas unas de otras — cada una tiene objetivo, público y estructura propios.
      </p>
      <div
        className={`mb-8 rounded-xl border ${coachBorder} px-5 py-4 ${coachBg.cardAlt}`}
      >
        <p className={`text-sm font-bold uppercase tracking-wide text-[#6A1F6D] mb-2`}>Coherencia entre clases del mismo día</p>
        <p className={`text-base leading-relaxed ${coachText.primary}`}>{COACH_CLASS_DAY_COHERENCE}</p>
      </div>
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
                <div
                  className="py-1 px-3 rounded-lg text-sm font-black uppercase tracking-tight inline-block font-evo-display"
                  style={{ backgroundColor: `${bar}22`, color: '#1A0A1A' }}
                >
                  {c.title.split('—')[0].trim()}
                </div>
                <h3 className={`text-base font-bold ${coachText.primary} leading-snug font-evo-body`}>{c.title}</h3>
                <p className={`text-base ${coachText.muted}`}>
                  <span className={`font-bold ${coachText.primary}`}>A quién va — </span>
                  {c.audience}
                </p>
                <p className={`text-base ${coachText.muted}`}>
                  <span className={`font-bold ${coachText.primary}`}>Qué tiene — </span>
                  {c.has}
                </p>
                <p className={`text-base ${coachText.muted} whitespace-pre-wrap`}>
                  <span className={`font-bold ${coachText.primary}`}>Estructura tipo — </span>
                  {c.structure}
                </p>
                <p className={`text-base ${coachText.muted}`}>
                  <span className={`font-bold ${coachText.primary}`}>Lo que puede tener — </span>
                  {c.can}
                </p>
                <p className={`text-base ${coachText.muted}`}>
                  <span className={`font-bold ${coachText.primary}`}>Lo que NO puede tener — </span>
                  {c.cannot}
                </p>
                {c.scale && (
                  <p className={`text-base ${coachText.muted}`}>
                    <span className={`font-bold ${coachText.primary}`}>Escalado — </span>
                    {c.scale}
                  </p>
                )}
                {c.weekNote && (
                  <p className={`text-sm ${coachText.muted} border-t ${coachBorder} pt-3`}>{c.weekNote}</p>
                )}
                <p className={`text-base italic border-t ${coachBorder} pt-4 ${coachText.accent}`}>{c.feel}</p>
              </div>
            </article>
          )
        })}
      </div>
      <p className={`text-base ${coachText.muted} mt-10 font-medium leading-relaxed`}>{COACH_CLASSES_FOOTNOTE}</p>
    </CoachGuideScroll>
  )
}

export function CoachGuideMesociclos() {
  return (
    <CoachGuideScroll>
      <h2 className={coachUi.h2}>3. Los mesociclos — Cómo funciona la progresión</h2>
      <div className={coachUi.prose}>
        {COACH_MESOCICLO_INTRO.map((p, i) => (
          <p key={i} className={coachText.muted}>
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
      <h3 className={`text-base font-bold mt-10 mb-3 ${coachText.primary} font-evo-display`}>{COACH_MESOCICLO_COACH[0]}</h3>
      <ul className={`list-disc pl-6 space-y-2 text-base ${coachText.muted}`}>
        {COACH_MESOCICLO_COACH.slice(1).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <div className={`${coachUi.card} mt-10 space-y-4`}>
        <h3 className={`text-base font-extrabold uppercase tracking-wide ${coachText.primary} font-evo-display`}>{COACH_MESOCICLO_AUTOCARGA_SUB}</h3>
        <MesoTable
          columns={[
            { key: 'semana', label: 'Semana' },
            { key: 'fase', label: 'Fase' },
            { key: 'estimulo', label: 'Estímulo' },
            { key: 'notas', label: 'Qué notas en clase' },
          ]}
          rows={COACH_MESOCICLO_AUTOCARGA_ROWS}
          rowKey={(r) => r.semana}
        />
      </div>
      <h3 className={`${coachUi.h3} mt-10`}>{COACH_MESOCICLO_MIXTO_TITLE}</h3>
      <MesoTable
        columns={[
          { key: 'semana', label: 'Semana' },
          { key: 'fase', label: 'Fase' },
          { key: 'estimulo', label: 'Estímulo' },
          { key: 'notas', label: 'Qué notas en clase' },
        ]}
        rows={COACH_MESOCICLO_MIXTO_ROWS}
        rowKey={(r) => r.semana}
      />
      <div className={`${coachUi.card} mt-10 space-y-3`}>
        <h3 className={`text-base font-extrabold uppercase tracking-wide ${coachText.title} font-evo-display`}>
          {COACH_MESOCICLO_ESPECIALIDADES_TITLE}
        </h3>
        {COACH_MESOCICLO_ESPECIALIDADES_PARAS.map((line, i) => (
          <p key={i} className={`text-base leading-relaxed ${coachText.primary}`}>
            {line}
          </p>
        ))}
      </div>
      <div className={`${coachUi.card} mt-10 space-y-4`}>
        <h3 className={`text-base font-extrabold uppercase tracking-wide ${coachText.primary} font-evo-display`}>{COACH_PROGRESSION_PRINCIPLE_TITLE}</h3>
        <ul className={`list-disc pl-6 space-y-3 text-base ${coachText.primary}`}>
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
      <p className={`text-base ${coachText.muted} mb-8 leading-relaxed`}>
        La app del programador genera el JSON que ves aquí. Tú recibes la semana ya publicada: días, bloques por clase y feedback.
      </p>
      {COACH_USO_SECTIONS.map((sec) => (
        <section key={sec.h} className={`mb-10 ${coachUi.card} overflow-hidden`}>
          <h3 className="text-lg sm:text-xl font-black mb-4 px-5 py-4 -mx-0 -mt-0 bg-[#1A0D1A] text-white font-evo-display uppercase tracking-wide">
            {sec.h}
          </h3>
          <ul className={`text-base space-y-3 leading-relaxed list-disc pl-6 pr-5 pb-5 ${coachText.muted}`}>
            {sec.lines.map((line, i) => (
              <li key={i} className="whitespace-pre-wrap">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </CoachGuideScroll>
  )
}

function normalizeMaterialRows(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter((r) => r && (String(r.name || '').trim() || String(r.qty || '').trim() || String(r.rules || '').trim()))
}

export function CoachGuideMaterial({ guideSettings }) {
  const override = guideSettings?.material_override?.trim()
  const tableRows = normalizeMaterialRows(guideSettings?.material_table)

  return (
    <CoachGuideScroll>
      <h2 className={coachUi.h2}>5. Material disponible</h2>
      <p className={`text-base ${coachText.muted} mb-8 leading-relaxed`}>{COACH_MATERIAL_INTRO}</p>
      {tableRows.length > 0 ? (
        <div className="mb-8">
          <h3 className={coachUi.h3}>Tabla del centro (editable en admin)</h3>
          <p className={`text-sm ${coachText.muted} mb-3`}>
            Complemento a la referencia completa de abajo. Si aquí solo hay pocas filas, el inventario detallado sigue en «Inventario de referencia».
          </p>
          <div className={coachUi.tableWrap}>
            <table className="w-full text-left text-base min-w-[280px]">
              <thead>
                <tr className={coachUi.tableHead}>
                  <th className="px-4 py-3 font-bold uppercase text-[12px]">Material</th>
                  <th className="px-4 py-3 font-bold uppercase text-[12px]">Cantidad</th>
                  <th className="px-4 py-3 font-bold uppercase text-[12px]">Reglas</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i} className={`border-t ${coachBorder} ${i % 2 === 0 ? coachBg.rowA : coachBg.rowB}`}>
                    <td className={`px-4 py-3 font-bold ${coachText.primary}`}>{r.name || '—'}</td>
                    <td className={`px-4 py-3 ${coachText.muted}`}>{r.qty || '—'}</td>
                    <td className={`px-4 py-3 ${coachText.muted}`}>{r.rules || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {override ? (
        <div className={`${coachUi.card} mb-8`}>
          <p className="text-xs font-bold text-[#A729AD] uppercase tracking-widest mb-3">Texto adicional (admin)</p>
          <pre className={`text-base whitespace-pre-wrap font-sans leading-relaxed ${coachText.primary}`}>{override}</pre>
        </div>
      ) : null}
      <h3 className={coachUi.h3}>Las dos salas</h3>
      <div className={`${coachUi.tableWrap} mb-8`}>
        <table className="w-full text-left text-base">
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
      <h3 className={coachUi.h3}>Inventario de referencia</h3>
      <p className={`text-sm ${coachText.muted} mb-4`}>
        Listado completo desde ProgramingEvo (actualizado con el código de la guía).
      </p>
      <div className="space-y-6 pb-4">
        {COACH_MATERIAL_ITEMS.map((item) => (
          <div key={item.name} className={coachUi.card}>
            <p className="text-sm font-bold uppercase tracking-wide mb-2 text-[#A729AD] font-evo-display">{item.name}</p>
            <pre className={`text-base whitespace-pre-wrap font-sans leading-relaxed ${coachText.muted}`}>{item.detail}</pre>
          </div>
        ))}
      </div>
    </CoachGuideScroll>
  )
}

export function CoachGuideSoporteProtocol({ guideSettings, variant = 'full' }) {
  const ch = guideSettings?.contact_channel?.trim()
  const person = guideSettings?.contact_person?.trim()
  const schedule = guideSettings?.contact_schedule?.trim()
  const rt = guideSettings?.response_time?.trim() || guideSettings?.contact_response?.trim()
  const hasContact = Boolean(ch || person || schedule)

  /** Panel claro legible (acordeón del chat soporte). `compact` = texto claro sobre sidebar oscuro (legacy). */
  const isEmbedded = variant === 'embedded'
  const onBar = variant === 'compact' && !isEmbedded
  const tMain = isEmbedded ? coachText.primary : onBar ? coachText.onSidebar : coachText.primary
  const tMuted = isEmbedded ? 'text-[#2d2430]' : onBar ? coachText.mutedOnSidebar : coachText.muted
  const tBorder = isEmbedded ? 'border-[#6A1F6D]/40' : onBar ? 'border-white/25' : coachBorder
  const tCard = isEmbedded
    ? `border ${coachBorder} ${coachBg.card} shadow-sm`
    : onBar
      ? 'bg-white/10 border border-white/20'
      : `${coachBorder} ${coachBg.card}`
  const tAccent = isEmbedded ? 'text-[#6A1F6D]' : onBar ? 'text-[#E8B4F0]' : coachText.accent
  const h2Class = isEmbedded
    ? `text-base font-extrabold uppercase tracking-wide border-b ${tBorder} pb-2 mb-3 text-[#1A0A1A] font-evo-display`
    : onBar
      ? `text-base font-extrabold uppercase tracking-wide border-b ${tBorder} pb-2 mb-3 ${tMain} font-evo-display`
      : coachUi.h2
  const h3Class = isEmbedded
    ? `text-[15px] font-bold mt-4 mb-2 text-[#1A0A1A] font-evo-body`
    : onBar
      ? `text-base font-bold mt-4 mb-2 ${tMain} font-evo-body`
      : coachUi.h3

  const inner = (
    <>
      <h2 className={h2Class}>
        6. Soporte — Cómo preguntar dudas
      </h2>
      <p className={`text-[15px] sm:text-base font-medium ${tMuted} mb-6 leading-relaxed`}>{COACH_SOPORTE_INTRO}</p>
      <h3 className={h3Class}>Qué tipo de dudas van por soporte</h3>
      <ul
        className={`list-disc pl-5 sm:pl-6 space-y-2 text-[15px] sm:text-base font-medium mb-6 ${
          isEmbedded ? 'text-[#2d2430]' : `text-base ${tMuted}`
        }`}
      >
        {COACH_SOPORTE_SI.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <h3 className={h3Class}>Qué NO va por soporte</h3>
      <ul
        className={`list-disc pl-5 sm:pl-6 space-y-2 text-[15px] sm:text-base font-medium mb-6 ${
          isEmbedded ? 'text-[#2d2430]' : `text-base ${tMuted}`
        }`}
      >
        {COACH_SOPORTE_NO.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <h3 className={h3Class}>Canal y persona de contacto</h3>
      {hasContact ? (
        <div className={`space-y-3 rounded-xl p-4 ${tCard}`}>
          {ch ? (
            <p className={`text-base whitespace-pre-wrap leading-relaxed ${tMain}`}>
              <span className={`font-bold ${tAccent}`}>Canal — </span>
              {ch}
            </p>
          ) : null}
          {person ? (
            <p className={`text-base ${tMain}`}>
              <span className={`font-bold ${tAccent}`}>Contacto — </span>
              {person}
            </p>
          ) : null}
          {schedule ? (
            <p className={`text-base ${tMuted}`}>
              <span className={`font-bold ${tMain}`}>Horario — </span>
              {schedule}
            </p>
          ) : null}
        </div>
      ) : (
        <p
          className={
            onBar
              ? 'text-base text-amber-100 bg-amber-500/15 border border-amber-400/40 rounded-xl p-4 leading-relaxed'
              : 'text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-4 leading-relaxed'
          }
        >
          {COACH_SOPORTE_PLACEHOLDER_CHANNEL}
          <span className={`block mt-3 text-xs font-bold uppercase tracking-wide ${onBar ? 'text-amber-200' : 'text-amber-800'}`}>
            Configúralo desde la app del programador: «Contenido Coach» (o Supabase → coach_guide_settings).
          </span>
        </p>
      )}
      <h3 className={h3Class}>Tiempo de respuesta esperado</h3>
      {rt ? (
        <p
          className={`text-[15px] sm:text-base whitespace-pre-wrap leading-relaxed rounded-xl p-4 border ${
            isEmbedded
              ? `${coachBorder} ${coachBg.card} text-[#1A0A1A]`
              : onBar
                ? 'border-white/25 bg-white/10'
                : `${coachBorder} ${coachBg.card}`
          } ${isEmbedded ? '' : tMain}`}
        >
          {rt}
        </p>
      ) : (
        <p
          className={
            onBar
              ? 'text-base text-amber-100 bg-amber-500/15 border border-amber-400/40 rounded-xl p-4 leading-relaxed'
              : 'text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-4 leading-relaxed'
          }
        >
          {COACH_SOPORTE_PLACEHOLDER_RESPONSE}
        </p>
      )}
      <p
        className={`text-[11px] font-bold uppercase tracking-widest mt-8 text-center ${
          isEmbedded ? 'text-[#5c4d6b]' : tMuted
        }`}
      >
        {COACH_SOPORTE_FOOTER}
      </p>
    </>
  )

  if (variant === 'embedded') {
    return <div className="px-4 py-4 space-y-2 bg-white">{inner}</div>
  }

  if (variant === 'compact') {
    return <div className="px-6 py-5 space-y-3">{inner}</div>
  }

  return <CoachGuideScroll className="pb-8">{inner}</CoachGuideScroll>
}
