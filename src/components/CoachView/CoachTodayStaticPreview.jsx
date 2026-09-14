import { useState } from 'react'
import CoachTodayScreenV2 from './CoachTodayScreenV2.jsx'

const previewWeek = {
  dias: [
    {
      nombre: 'LUNES',
      evofuncional: 'A) FUERZA — 5 series (10\')\n6 Goblet Squats\n\nB) 3 rondas · 40\'\' trabajo / 20\'\' pausa\nEmpuje, tracción, sentadilla y core.',
      feedback_funcional: 'Chicos, hoy buscamos una sentadilla fuerte y controlada. Elegid una carga que os deje mantener el rango y la técnica en todas las rondas.',
      evofit: 'A) FUERZA — 3 series\n8 DB Press\n\nB) AMRAP 12\'\nTrabajo continuo y ordenado.',
      feedback_fit: 'Mantened una carga sostenible y evitad correr entre movimientos.',
    },
    { nombre: 'MARTES' },
    { nombre: 'MIÉRCOLES' },
    { nombre: 'JUEVES' },
    { nombre: 'VIERNES' },
  ],
}

/** Solo para comprobar la interfaz local sin Supabase ni datos reales. */
export default function CoachTodayStaticPreview() {
  const [activeDay, setActiveDay] = useState('LUNES')
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <>
      <CoachTodayScreenV2
        weekData={previewWeek}
        activeDay={activeDay}
        setActiveDay={setActiveDay}
        todayHandoffs={[]}
        onOpenFeedback={() => setFeedbackOpen(true)}
      />
      {feedbackOpen ? (
        <div className="fixed inset-0 z-[200] flex items-end bg-black/70 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Feedback de prueba">
          <div className="w-full max-w-md rounded-2xl border border-[#A729AD]/60 bg-[#1A0F1B] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFFF4C]">Vista de prueba</p>
            <h2 className="mt-2 font-evo-display text-2xl font-bold text-[#F6E8F9]">Aquí conservarás el feedback actual</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#F6E8F9]/75">Esta previsualización no guarda nada. El formulario existente se conectará en la siguiente integración.</p>
            <button type="button" onClick={() => setFeedbackOpen(false)} className="mt-6 w-full rounded-xl border border-[#F6E8F9]/35 px-4 py-3 text-sm font-bold text-[#F6E8F9]">Cerrar</button>
          </div>
        </div>
      ) : null}
    </>
  )
}
