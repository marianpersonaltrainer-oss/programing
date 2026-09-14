import { HEAD_COACH_ADAPTATION_DRAFT } from '../../data/headCoachAdaptationDraft.js'
import { coachBg, coachBorder, coachText, coachUi } from './coachTheme.js'

/**
 * Referencia local y deliberadamente inerte: no recibe datos de personas,
 * no aconseja sobre casos concretos ni escribe en Supabase.
 */
export default function CoachAdaptationMethodPanel() {
  const method = HEAD_COACH_ADAPTATION_DRAFT

  return (
    <div className={`${coachUi.scroll} mx-auto max-w-2xl space-y-6 pb-24`}>
      <header>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#A729AD]">Head Coach · borrador interno</p>
        <h1 className={`mt-2 font-evo-display text-2xl font-black ${coachText.primary}`}>Método y adaptaciones</h1>
        <p className={`mt-3 text-sm leading-relaxed ${coachText.muted}`}>
          Referencia general para consolidar el método EVO. Todavía no está conectada a recomendaciones individuales ni cambia una clase.
        </p>
      </header>

      <section className="rounded-2xl border border-[#FFFF4C]/35 bg-[#FFFF4C]/10 p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFFF4C]">Regla principal</p>
        <p className="mt-2 text-base font-semibold leading-relaxed text-[#F6E8F9]">{method.principle}</p>
      </section>

      <section className={`${coachBg.card} rounded-2xl border ${coachBorder} p-5`}>
        <h2 className={`font-evo-display text-base font-bold ${coachText.primary}`}>Límites de seguridad</h2>
        <ul className={`mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed ${coachText.muted}`}>
          {method.boundaries.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>

      <div className="space-y-4">
        {method.sections.map((section) => (
          <section key={section.id} className={`${coachBg.card} rounded-2xl border ${coachBorder} p-5`}>
            <h2 className={`font-evo-display text-base font-bold ${coachText.primary}`}>{section.title}</h2>
            <p className={`mt-2 text-sm leading-relaxed ${coachText.muted}`}>{section.purpose}</p>
            <ul className={`mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed ${coachText.primary}`}>
              {section.options.map((option) => <li key={option}>{option}</li>)}
            </ul>
          </section>
        ))}
      </div>

      <section className={`${coachBg.card} rounded-2xl border ${coachBorder} p-5`}>
        <h2 className={`font-evo-display text-base font-bold ${coachText.primary}`}>Qué quedará para revisión</h2>
        <ul className={`mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed ${coachText.muted}`}>
          {method.reviewRecord.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>
    </div>
  )
}
