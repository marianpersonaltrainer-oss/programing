import EvoLogo from '../EvoLogo.jsx'
import CoachShiftPreparationPreview from './CoachShiftPreparationPreview.jsx'
import { coachBg, coachBorder, coachText } from './coachTheme.js'

/** Vista aislada para validar el panel sin consultar Supabase ni APIs. */
export default function CoachPilotPreview() {
  return (
    <main className={`min-h-screen ${coachBg.app} ${coachText.primary} font-evo-body`}>
      <header className={`flex min-h-[4.25rem] items-center justify-between border-b ${coachBorder} px-5`}>
        <div className="flex items-center gap-3"><EvoLogo /><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#E7B8EA]">EVO Coach · prueba privada</span></div>
        <span className="rounded-full border border-amber-300/40 bg-amber-950/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-100">Datos ficticios</span>
      </header>
      <CoachShiftPreparationPreview />
    </main>
  )
}
