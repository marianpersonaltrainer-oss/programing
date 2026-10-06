import { useEffect, useMemo, useState } from 'react'

const SHIFT_START = 18 * 60
const SHIFT_END = 22 * 60

const sessions = [
  { start: 1080, end: 1130, time: '18:00', label: 'Basics', color: '#D98762', focus: 'Prueba', action: 'Preparar' },
  { start: 1140, end: 1190, time: '19:00', label: 'Fit', color: '#91B79B', focus: 'Primera vez contigo', action: 'Leer' },
  { start: 1200, end: 1250, time: '20:00', label: 'Funcional', color: '#7C9DDF', focus: 'Adaptación prevista', action: 'Revisar' },
  { start: 1260, end: 1310, time: '21:00', label: 'Basics', color: '#D98762', focus: null, action: null },
]

function madridNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0)
  const hour = value('hour')
  const minute = value('minute')
  return { minutes: hour * 60 + minute, label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` }
}

function CircleClock({ minutes, activeSession }) {
  const progress = Math.max(0, Math.min(1, (minutes - SHIFT_START) / (SHIFT_END - SHIFT_START)))
  const background = 'conic-gradient(from -90deg, #D98762 0deg 88deg, #15121e 88deg 92deg, #91B79B 92deg 178deg, #15121e 178deg 182deg, #7C9DDF 182deg 268deg, #15121e 268deg 272deg, #D98762 272deg 358deg, #15121e 358deg 360deg)'
  return <div className="relative mx-auto mt-7 aspect-square w-full max-w-[19rem]">
    <div className="absolute inset-0 rounded-full p-[7px] shadow-[0_0_0_1px_rgba(155,92,246,0.28)]" style={{ background }}>
      <div className="relative h-full w-full rounded-full bg-[#100d15] ring-1 ring-white/5">
        <div className="absolute left-1/2 top-1/2 h-[44%] w-px origin-bottom bg-[#9C6BFF]" style={{ transform: `translate(-50%, -100%) rotate(${progress * 360}deg)` }} />
        <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#A873FF] shadow-[0_0_18px_rgba(168,115,255,0.65)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="font-evo-display text-5xl text-[#F4E9FF]">3</span><span className="mt-1 text-sm text-[#C8B5DD]">personas a<br />preparar</span><span className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#A873FF]">{activeSession ? `${activeSession.time} en curso` : minutes < SHIFT_START ? '18:00 primero' : 'turno finalizado'}</span></div>
      </div>
    </div>
  </div>
}

/** Piloto visual: muestra la hora real, pero no consulta ni persiste datos. */
export default function CoachShiftPreparationPreview() {
  const [clock, setClock] = useState(madridNow)
  const [trialCloseOpen, setTrialCloseOpen] = useState(false)
  const [trialClosed, setTrialClosed] = useState(false)
  const [level, setLevel] = useState('Basics')
  const [completion, setCompletion] = useState('Completó con adaptación')
  const [coordination, setCoordination] = useState('En aprendizaje')
  const [note, setNote] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setClock(madridNow()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const activeSession = useMemo(() => sessions.find((session) => clock.minutes >= session.start && clock.minutes < session.end), [clock.minutes])
  const nextSession = useMemo(() => sessions.find((session) => clock.minutes < session.start) || sessions[0], [clock.minutes])
  const focusSession = activeSession || nextSession

  return <section className="mx-auto w-full max-w-md px-5 py-7 pb-10 text-[#F4E9FF]">
    <header className="flex items-start justify-between"><div><p className="font-evo-display text-4xl tracking-[0.12em]">EVO</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.35em] text-[#BDA6D5]">Coach · mesa de turno</p></div><div className="pt-2 text-right"><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#BDA6D5]">Hora real</p><p className="mt-1 font-evo-display text-2xl text-[#B88AFF]">{clock.label}</p></div></header>

    <section className="mt-8 border-t border-[#6F4FA5]/45 pt-5"><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.23em] text-[#C4AEDC]">Martes · 18:00—22:00</p><span className="text-[10px] text-[#9C85B8]">Piloto ficticio</span></div><CircleClock minutes={clock.minutes} activeSession={activeSession} /><div className="mt-5 grid grid-cols-4 gap-1.5">{sessions.map((session) => <div key={session.time} className="text-center"><span className="block h-1 rounded-full" style={{ backgroundColor: session.color }} /><p className="mt-2 text-xs text-[#E9DDF4]">{session.time}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: session.color }}>{session.label}</p></div>)}</div></section>

    <section className="mt-9 border-t border-[#6F4FA5]/45 pt-5"><div className="flex items-baseline justify-between"><h1 className="font-evo-display text-3xl">Hoy en tu mesa</h1><span className="text-xs text-[#B88AFF]">3 focos</span></div><p className="mt-2 text-sm text-[#C8B5DD]">Solo lo que cambia cómo das tu turno.</p><div className="mt-4 divide-y divide-[#6F4FA5]/35 border-y border-[#6F4FA5]/35">{sessions.filter((session) => session.focus).map((session) => <button key={session.time} type="button" onClick={() => session.time === '18:00' && setTrialCloseOpen(true)} className="flex w-full items-center gap-3 py-5 text-left"><span className="h-10 w-1 rounded-full" style={{ backgroundColor: session.color }} /><div className="min-w-0 flex-1"><p className="font-evo-display text-2xl leading-none">{session.focus}</p><p className="mt-1 text-sm text-[#BDA6D5]">{session.time} · {session.label}</p></div><span className="text-sm font-bold text-[#B88AFF]">{session.action} →</span></button>)}</div></section>

    <section className="mt-6 border border-[#6F4FA5]/40 bg-[#1a1422] px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#BDA6D5]">Ahora mismo</p><p className="mt-1 font-evo-display text-2xl">{focusSession.time} · <span style={{ color: focusSession.color }}>{focusSession.label}</span></p><p className="mt-2 text-sm text-[#D4C3E4]">{activeSession ? 'Clase en curso. La siguiente preparación espera en tu mesa.' : 'Abre su preparación antes de entrar a la clase.'}</p></section>

    <button type="button" onClick={() => setTrialCloseOpen(true)} className="mt-6 flex w-full items-center justify-between border-t border-[#6F4FA5]/45 py-5 text-left"><span className="text-sm text-[#C8B5DD]">Al acabar una prueba · {trialClosed ? 'cierre enviado' : 'cierre en 2 min'}</span><span className="text-2xl text-[#B88AFF]">›</span></button>

    {trialCloseOpen ? <div className="fixed inset-0 z-50 flex items-end bg-black/75 sm:items-center sm:justify-center sm:p-5"><section className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[#8A5CF6]/60 bg-[#16101d] p-5 sm:rounded-3xl"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D98762]">Clase de prueba · cierre inmediato</p><h2 className="mt-2 font-evo-display text-2xl">En uno o dos minutos</h2><p className="mt-2 text-sm text-[#C8B5DD]">El siguiente entrenador y el seguimiento reciben solo lo necesario para continuar.</p><label className="mt-5 block text-sm font-bold">Entrenamiento de hoy</label><select value={completion} onChange={(event) => setCompletion(event.target.value)} className="mt-2 w-full rounded-xl border border-[#6F4FA5]/55 bg-black/20 p-3 text-sm text-white"><option>Completó la sesión</option><option>Completó con adaptación</option><option>No completó una parte</option></select><label className="mt-5 block text-sm font-bold">Coordinación</label><div className="mt-2 flex flex-wrap gap-2">{['Fluida', 'En aprendizaje', 'Requiere acompañamiento'].map((item) => <button key={item} type="button" onClick={() => setCoordination(item)} className={`rounded-xl px-3 py-2 text-xs ${coordination === item ? 'bg-[#8A5CF6] text-white' : 'border border-white/15 text-[#D7C4E5]'}`}>{item}</button>)}</div><label className="mt-5 block text-sm font-bold">Carga, adaptación o molestia</label><textarea placeholder="Carga aproximada, qué se adaptó y qué toleró. No diagnostiques." className="mt-2 min-h-24 w-full rounded-xl border border-[#6F4FA5]/55 bg-black/20 p-3 text-sm text-white placeholder:text-[#AFA0C9]" /><label className="mt-5 block text-sm font-bold">Nivel recomendado</label><div className="mt-2 flex gap-2">{['Basics', 'Intermedio'].map((item) => <button key={item} type="button" onClick={() => setLevel(item)} className={`rounded-xl px-4 py-2 text-sm ${level === item ? 'bg-[#8A5CF6] text-white' : 'border border-white/15 text-[#D7C4E5]'}`}>{item}</button>)}</div><label className="mt-5 block text-sm font-bold">Una prioridad para la siguiente clase</label><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Solo lo útil para continuar." className="mt-2 min-h-20 w-full rounded-xl border border-[#6F4FA5]/55 bg-black/20 p-3 text-sm text-white placeholder:text-[#AFA0C9]" /><div className="mt-5 flex gap-3"><button type="button" onClick={() => { setTrialClosed(true); setTrialCloseOpen(false) }} className="rounded-xl bg-[#8A5CF6] px-4 py-3 text-sm font-bold text-white">Enviar cierre</button><button type="button" onClick={() => setTrialCloseOpen(false)} className="px-3 text-sm font-bold text-[#D7C4E5]">Ahora no</button></div><p className="mt-3 text-xs text-[#AFA0C9]">Piloto: no guarda ni envía datos reales.</p></section></div> : null}
  </section>
}
