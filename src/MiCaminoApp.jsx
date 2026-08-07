import { useEffect, useMemo, useState } from 'react'
import { useMiCamino } from './miCamino/useMiCamino.js'
import { miCaminoShadow, miCaminoTheme as theme } from './miCamino/theme.js'

const NAV_ITEMS = [
  { id: 'hoy', label: 'Hoy', path: '/mi-camino/hoy', icon: SunIcon },
  { id: 'camino', label: 'Mi camino', path: '/mi-camino/camino', icon: PathIcon },
  { id: 'evolucion', label: 'Evolución', path: '/mi-camino/evolucion', icon: ProgressIcon },
  { id: 'perfil', label: 'Perfil', path: '/mi-camino/perfil', icon: PersonIcon },
]

function routeFromLocation() {
  const path = window.location.pathname.toLowerCase()
  if (path.includes('/evolucion')) return 'evolucion'
  if (path.includes('/camino')) return 'camino'
  if (path.includes('/perfil')) return 'perfil'
  return 'hoy'
}

function navigateTo(item, setView) {
  window.history.pushState({}, '', item.path)
  setView(item.id)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function formatDate(value, options = {}) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: options.weekday || undefined,
      day: 'numeric',
      month: 'short',
      hour: options.time ? '2-digit' : undefined,
      minute: options.time ? '2-digit' : undefined,
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function clampPct(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function getMilestonePresentation(row) {
  const def = row?.mc_milestone_definitions || {}
  const evidence = row?.evidence || {}
  const config = def?.trigger_config || {}
  const current = Number(evidence.current ?? evidence.attendance_count ?? 0)
  const target = Number(config.count ?? config.target ?? evidence.target ?? 0)
  return {
    name: def.name || 'Nuevo hito',
    key: def.milestone_key || 'milestone',
    category: def.category || 'continuity',
    current,
    target,
    pct: target > 0 ? clampPct((current / target) * 100) : row?.status === 'celebrated' ? 100 : 0,
    celebrated: row?.status === 'celebrated',
  }
}

function getNextMilestone(milestones) {
  const candidates = (milestones || []).map(getMilestonePresentation)
  const pending = candidates.find((item) => item.target > 0 && item.current < item.target)
  if (pending) return pending
  const latest = candidates[0]
  if (latest) return latest
  return { name: 'En marcha', current: 0, target: 10, pct: 0, category: 'continuity', key: 'en_marcha' }
}

function getChallengeSummary(challenges, type) {
  const challenge = (challenges || []).find((item) => item.challenge_type === type)
  if (!challenge) return null
  const rows = challenge.progressRows || []
  const target = Number(challenge.rules?.target || 0)
  const progress = rows.reduce((sum, row) => sum + Number(row.progress || 0), 0)
  return {
    ...challenge,
    target,
    progress,
    pct: target > 0 ? clampPct((progress / target) * 100) : 0,
    rows,
  }
}

function resolveHomePrimary({ currentState, planB, resources }) {
  if (planB) {
    return {
      eyebrow: 'Esta semana se ha complicado',
      title: planB.mc_plan_b_catalog?.name || 'Tienes un Plan B preparado',
      body: 'No hace falta esperar a que todo vuelva a estar perfecto. Puedes mantener el camino con una opción adaptada.',
      action: 'Ver mi Plan B',
      target: 'camino',
      tone: 'warm',
    }
  }

  const resource = resources?.[0]
  if (resource) {
    return {
      eyebrow: 'Tu siguiente paso',
      title: resource.mc_resources?.title || 'Tienes algo preparado para ti',
      body: 'Es una acción corta y relacionada con el momento en el que estás ahora.',
      action: 'Abrir',
      target: 'camino',
      tone: 'lilac',
    }
  }

  if (currentState?.next_reserved_at) {
    return {
      eyebrow: 'Tu siguiente paso',
      title: `Próxima clase · ${formatDate(currentState.next_reserved_at, { weekday: 'short', time: true })}`,
      body: 'Tu semana ya está en marcha. Solo tienes que llegar y entrenar.',
      action: 'Ver mi camino',
      target: 'camino',
      tone: 'lilac',
    }
  }

  return {
    eyebrow: 'Tu siguiente paso',
    title: 'Sigue construyendo tu rutina',
    body: 'Cuando tengas tu próxima reserva, aparecerá aquí. No necesitas hacer nada más ahora.',
    action: 'Ver mi camino',
    target: 'camino',
    tone: 'neutral',
  }
}

export default function MiCaminoApp() {
  const mi = useMiCamino()
  const [view, setView] = useState(routeFromLocation)

  useEffect(() => {
    const onPop = () => setView(routeFromLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (mi.loading) return <FullPageStatus text="Preparando tu camino…" />
  if (!mi.isAuthenticated) return <MiCaminoLogin {...mi} />
  if (!mi.isLinkedCustomer) {
    return (
      <FullPageStatus
        title="Tu acceso está casi listo"
        text="Tu cuenta existe, pero todavía no está vinculada a tu ficha EVO. El equipo puede resolverlo sin que tengas que volver a registrarte."
        actionLabel="Salir"
        onAction={mi.signOut}
      />
    )
  }

  const activeItem = NAV_ITEMS.find((item) => item.id === view) || NAV_ITEMS[0]

  return (
    <div className="min-h-screen pb-28 font-evo-body" style={{ backgroundColor: theme.background, color: theme.ink }}>
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-xl" style={{ borderColor: theme.line }}>
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.achievementGold }}>
              Mi Camino
            </div>
            <div className="font-evo-display text-lg font-bold uppercase tracking-[0.06em]" style={{ color: theme.purple }}>
              EVO
            </div>
          </div>
          <button
            type="button"
            onClick={mi.refresh}
            disabled={mi.refreshing}
            className="flex h-11 w-11 items-center justify-center rounded-full border bg-white transition disabled:opacity-50"
            style={{ borderColor: theme.line, color: theme.purple }}
            aria-label="Actualizar Mi Camino"
          >
            <RefreshIcon className={mi.refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-7">
        {mi.error ? <InlineError message={mi.error} /> : null}
        {activeItem.id === 'hoy' && <TodayView mi={mi} onNavigate={(id) => navigateTo(NAV_ITEMS.find((x) => x.id === id), setView)} />}
        {activeItem.id === 'camino' && <JourneyView mi={mi} />}
        {activeItem.id === 'evolucion' && <EvolutionView mi={mi} />}
        {activeItem.id === 'perfil' && <ProfileView mi={mi} />}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
        style={{ borderColor: theme.line }}
        aria-label="Navegación principal"
      >
        <div className="mx-auto grid max-w-xl grid-cols-4 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const selected = item.id === view
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item, setView)}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition"
                style={{ color: selected ? theme.purple : theme.inkSoft, backgroundColor: selected ? theme.surfaceLilac : 'transparent' }}
              >
                <Icon filled={selected} />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function TodayView({ mi, onNavigate }) {
  const name = mi.person?.full_name?.split(' ')?.[0] || 'Hola'
  const nextMilestone = getNextMilestone(mi.milestones)
  const primary = resolveHomePrimary(mi)
  const frequency = Number(mi.currentState?.agreed_weekly_frequency || mi.person?.agreed_weekly_frequency || 0)
  const weekDone = Number(mi.currentState?.state?.week_attendance_count || 0)
  const weekTarget = frequency || Number(mi.currentState?.state?.week_target || 0)

  return (
    <section className="space-y-5">
      <div className="pb-2">
        <p className="text-sm" style={{ color: theme.inkSoft }}>Hola, {name}</p>
        <h1 className="mt-1 font-evo-display text-4xl font-bold tracking-tight">Hoy</h1>
      </div>

      <button
        type="button"
        onClick={() => onNavigate(primary.target)}
        className="w-full rounded-3xl border p-6 text-left transition active:scale-[0.99]"
        style={{
          borderColor: primary.tone === 'warm' ? theme.achievementGoldSoft : theme.line,
          backgroundColor: primary.tone === 'warm' ? theme.surfaceWarm : primary.tone === 'lilac' ? theme.surfaceLilac : theme.surface,
          boxShadow: miCaminoShadow,
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: primary.tone === 'warm' ? theme.achievementGold : theme.purple }}>
          {primary.eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-bold leading-tight">{primary.title}</h2>
        <p className="mt-2 text-sm leading-6" style={{ color: theme.inkSoft }}>{primary.body}</p>
        <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold" style={{ backgroundColor: theme.purple, color: '#fff' }}>
          {primary.action} <ArrowIcon />
        </span>
      </button>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.inkSoft }}>Esta semana</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="font-evo-display text-4xl font-bold" style={{ color: theme.purple }}>{weekTarget ? Math.min(weekDone, weekTarget) : '—'}</span>
            <span className="pb-1 text-sm" style={{ color: theme.inkSoft }}>/ {weekTarget || 'sin objetivo'}</span>
          </div>
          {weekTarget > 0 ? <ProgressBar value={(weekDone / weekTarget) * 100} /> : null}
        </Card>

        <button type="button" onClick={() => onNavigate('evolucion')} className="text-left">
          <Card interactive>
            <div className="flex items-center gap-3">
              <BadgeGlyph name={nextMilestone.name} size="sm" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.achievementGold }}>Próximo hito</p>
                <p className="mt-1 truncate text-lg font-bold">{nextMilestone.name}</p>
                {nextMilestone.target > 0 ? (
                  <p className="mt-1 text-xs" style={{ color: theme.inkSoft }}>{nextMilestone.current} / {nextMilestone.target}</p>
                ) : null}
              </div>
            </div>
          </Card>
        </button>
      </div>
    </section>
  )
}

function JourneyView({ mi }) {
  const state = mi.currentState
  const planB = mi.planB
  const resource = mi.resources?.[0]
  const stage = state?.current_stage || 'Tu etapa aparecerá aquí'
  const journeyNames = {
    return_after_pause: 'Volver a coger mi rutina',
    organization: 'Encontrar mi forma de organizarme',
    all_or_nothing: 'Construir constancia sin empezar de cero',
  }

  return (
    <section className="space-y-5">
      <PageTitle eyebrow="Tu recorrido" title="Mi camino" />

      <Card featured>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.achievementGold }}>Objetivo actual</p>
        <h2 className="mt-3 text-2xl font-bold leading-tight">{journeyNames[state?.journey_key] || 'Tu siguiente etapa EVO'}</h2>
        <p className="mt-3 text-sm leading-6" style={{ color: theme.inkSoft }}>{stage}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {state?.start_date ? <Pill>{`Desde ${formatDate(state.start_date)}`}</Pill> : null}
          {mi.person?.agreed_weekly_frequency ? <Pill>{`${mi.person.agreed_weekly_frequency} entrenos / semana`}</Pill> : null}
        </div>
      </Card>

      {planB ? (
        <Card tone="warm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.achievementGoldSoft, color: theme.achievementGold }}>
              <BoltIcon />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.achievementGold }}>Plan B activo</p>
              <h3 className="mt-1 text-xl font-bold">{planB.mc_plan_b_catalog?.name || 'Mantengo el movimiento'}</h3>
              <p className="mt-2 text-sm leading-6" style={{ color: theme.inkSoft }}>
                {planB.mc_plan_b_catalog?.duration_min ? `${planB.mc_plan_b_catalog.duration_min} min. ` : ''}
                Una alternativa para mantener tu semana sin intentar compensar después.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {resource ? (
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.purple }}>Ahora te puede ayudar</p>
          <h3 className="mt-2 text-xl font-bold">{resource.mc_resources?.title}</h3>
          <p className="mt-2 text-sm leading-6" style={{ color: theme.inkSoft }}>Una guía corta, solo porque encaja con lo que estás trabajando ahora.</p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm leading-6" style={{ color: theme.inkSoft }}>Ahora mismo no tienes ninguna guía pendiente. Cuando realmente necesites una, aparecerá aquí.</p>
        </Card>
      )}
    </section>
  )
}

function EvolutionView({ mi }) {
  const next = getNextMilestone(mi.milestones)
  const earned = (mi.milestones || []).filter((row) => row.status !== 'cancelled').slice(0, 4)
  const personal = getChallengeSummary(mi.challenges, 'personal')
  const collective = getChallengeSummary(mi.challenges, 'collective')
  const teams = getChallengeSummary(mi.challenges, 'teams')

  return (
    <section className="space-y-6">
      <PageTitle eyebrow="Cada paso suma" title="Mi evolución" />

      <Card featured>
        <div className="grid items-center gap-5 sm:grid-cols-[140px_1fr]">
          <BadgeGlyph name={next.name} size="lg" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.purple }}>Próximo hito</p>
            <h2 className="mt-2 font-evo-display text-4xl font-bold leading-none">{next.name}</h2>
            {next.target > 0 ? (
              <>
                <p className="mt-4 text-lg"><strong style={{ color: theme.purple }}>{next.current}</strong> / {next.target} entrenos</p>
                <ProgressBar value={next.pct} gold />
                <p className="mt-2 text-xs" style={{ color: theme.inkSoft }}>Te faltan {Math.max(0, next.target - next.current)} entrenos</p>
              </>
            ) : (
              <p className="mt-4 text-sm" style={{ color: theme.inkSoft }}>Tu próximo logro aparecerá aquí.</p>
            )}
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Tus insignias</h2>
          <span className="text-sm font-semibold" style={{ color: theme.purple }}>Ver todas</span>
        </div>
        {earned.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {earned.map((row) => {
              const p = getMilestonePresentation(row)
              return (
                <Card key={row.id} compact>
                  <BadgeGlyph name={p.name} size="sm" />
                  <p className="mt-3 text-center text-sm font-bold">{p.name}</p>
                </Card>
              )
            })}
          </div>
        ) : (
          <EmptyPanel text="Tus insignias aparecerán a medida que vayas acumulando pasos reales." />
        )}
      </div>

      {personal ? (
        <Card>
          <SectionLabel>Tu reto</SectionLabel>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: theme.purpleSoft, color: theme.purple }}><TimerIcon /></div>
            <div className="flex-1">
              <h3 className="text-xl font-bold">{personal.name}</h3>
              <p className="mt-1 text-sm" style={{ color: theme.inkSoft }}>{personal.progress} / {personal.target || '—'}</p>
              <ProgressBar value={personal.pct} />
            </div>
          </div>
        </Card>
      ) : null}

      {collective ? (
        <Card tone="lilac">
          <SectionLabel>Misión EVO</SectionLabel>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm" style={{ color: theme.inkSoft }}>Progreso colectivo</p>
              <p className="mt-1 text-3xl font-bold" style={{ color: theme.purple }}>{collective.progress} <span className="text-base font-normal" style={{ color: theme.ink }}>/ {collective.target || '—'}</span></p>
            </div>
            <MountainIcon />
          </div>
          <ProgressBar value={collective.pct} />
        </Card>
      ) : null}

      {teams ? <TeamChallenge challenge={teams} /> : null}
    </section>
  )
}

function TeamChallenge({ challenge }) {
  const groups = new Map()
  for (const row of challenge.rows || []) {
    if (!row.team_key) continue
    groups.set(row.team_key, Number(groups.get(row.team_key) || 0) + Number(row.progress || 0))
  }
  const entries = [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  if (entries.length < 2) return null
  return (
    <Card compact>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: theme.surfaceLilac, color: theme.purple }}><GroupIcon /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Reto por equipos</p>
          <p className="mt-1 text-xs" style={{ color: theme.inkSoft }}>{entries[0][0]} {entries[0][1]} · {entries[1][0]} {entries[1][1]}</p>
        </div>
        <ArrowIcon />
      </div>
    </Card>
  )
}

function ProfileView({ mi }) {
  return (
    <section className="space-y-5">
      <PageTitle eyebrow="Tu cuenta" title="Perfil" />
      <Card>
        <p className="text-lg font-bold">{mi.person?.full_name}</p>
        <p className="mt-1 text-sm" style={{ color: theme.inkSoft }}>{mi.person?.email || mi.session?.user?.email}</p>
        <div className="mt-5 divide-y" style={{ borderColor: theme.line }}>
          <ProfileRow label="Frecuencia acordada" value={mi.person?.agreed_weekly_frequency ? `${mi.person.agreed_weekly_frequency} / semana` : 'Por definir'} />
          <ProfileRow label="Último entreno" value={mi.person?.last_attended_at ? formatDate(mi.person.last_attended_at) : '—'} />
          <ProfileRow label="Próxima reserva" value={mi.person?.next_reserved_at ? formatDate(mi.person.next_reserved_at, { time: true }) : '—'} />
        </div>
      </Card>
      <button
        type="button"
        onClick={mi.signOut}
        className="min-h-12 w-full rounded-2xl border bg-white px-4 text-sm font-bold"
        style={{ borderColor: theme.line, color: theme.purple }}
      >
        Cerrar sesión
      </button>
    </section>
  )
}

function MiCaminoLogin({ signIn, sendMagicLink, error, setError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('magic')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setSent(false)
    setError('')
    try {
      if (mode === 'magic') {
        await sendMagicLink(email)
        setSent(true)
      } else {
        await signIn(email, password)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen px-5 py-10 font-evo-body" style={{ backgroundColor: theme.background, color: theme.ink }}>
      <div className="mx-auto max-w-md pt-[8vh]">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: theme.achievementGold }}>Mi Camino</p>
          <h1 className="mt-2 font-evo-display text-5xl font-bold uppercase" style={{ color: theme.purple }}>EVO</h1>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-6" style={{ color: theme.inkSoft }}>Tu entrenamiento, tus avances y el siguiente paso, sin tener que hacerlo todo perfecto.</p>
        </div>

        <form onSubmit={submit} className="rounded-3xl border bg-white p-6" style={{ borderColor: theme.line, boxShadow: miCaminoShadow }}>
          <label className="text-sm font-bold" htmlFor="mc-email">Tu email</label>
          <input
            id="mc-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-2xl border px-4 text-base outline-none focus:ring-2"
            style={{ borderColor: theme.line }}
          />

          {mode === 'password' ? (
            <>
              <label className="mt-4 block text-sm font-bold" htmlFor="mc-password">Contraseña</label>
              <input
                id="mc-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border px-4 text-base outline-none focus:ring-2"
                style={{ borderColor: theme.line }}
              />
            </>
          ) : null}

          {error ? <InlineError message={error} /> : null}
          {sent ? <p className="mt-4 rounded-2xl p-3 text-sm" style={{ backgroundColor: theme.surfaceLilac, color: theme.purple }}>Te hemos enviado el acceso. Abre el enlace desde este dispositivo.</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 min-h-12 w-full rounded-2xl px-4 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: theme.purple }}
          >
            {busy ? 'Un momento…' : mode === 'magic' ? 'Enviarme acceso' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => { setMode((v) => v === 'magic' ? 'password' : 'magic'); setError('') }}
            className="mt-4 min-h-11 w-full text-sm font-semibold"
            style={{ color: theme.purple }}
          >
            {mode === 'magic' ? 'Entrar con contraseña' : 'Prefiero recibir un enlace'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Card({ children, compact = false, featured = false, tone = 'white', interactive = false }) {
  const bg = tone === 'warm' ? theme.surfaceWarm : tone === 'lilac' ? theme.surfaceLilac : theme.surface
  return (
    <div
      className={`${compact ? 'p-4' : 'p-5'} ${featured ? 'rounded-[1.75rem]' : 'rounded-3xl'} h-full border ${interactive ? 'transition hover:-translate-y-0.5' : ''}`}
      style={{ backgroundColor: bg, borderColor: theme.line, boxShadow: featured ? miCaminoShadow : '0 6px 24px rgba(58, 30, 59, 0.045)' }}
    >
      {children}
    </div>
  )
}

function BadgeGlyph({ name = 'EVO', size = 'sm' }) {
  const large = size === 'lg'
  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const icon = seed % 4
  return (
    <div className={`mx-auto flex ${large ? 'h-32 w-32' : 'h-16 w-16'} items-center justify-center rounded-[28%] border-[3px] shadow-lg`} style={{ background: `linear-gradient(145deg, ${theme.purple}, #35143B)`, borderColor: theme.achievementGold, color: '#F8E8C7' }} aria-hidden>
      {icon === 0 ? <PathIcon scale={large ? 1.8 : 1.1} /> : icon === 1 ? <BoltIcon scale={large ? 1.8 : 1.1} /> : icon === 2 ? <MountainIcon scale={large ? 1.35 : 0.8} /> : <ProgressIcon scale={large ? 1.8 : 1.1} />}
    </div>
  )
}

function ProgressBar({ value, gold = false }) {
  return (
    <div className="mt-3 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: gold ? theme.achievementGoldSoft : theme.purpleSoft }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${clampPct(value)}%`, backgroundColor: gold ? theme.achievementGold : theme.purple }} />
    </div>
  )
}

function PageTitle({ eyebrow, title }) {
  return (
    <div className="pb-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.achievementGold }}>{eyebrow}</p>
      <h1 className="mt-1 font-evo-display text-4xl font-bold tracking-tight">{title}</h1>
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.purple }}>{children}</p>
}

function Pill({ children }) {
  return <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: theme.surfaceLilac, color: theme.purple }}>{children}</span>
}

function ProfileRow({ label, value }) {
  return <div className="flex items-center justify-between gap-4 py-4 text-sm"><span style={{ color: theme.inkSoft }}>{label}</span><strong className="text-right">{value}</strong></div>
}

function EmptyPanel({ text }) {
  return <div className="rounded-3xl border border-dashed p-6 text-center text-sm leading-6" style={{ borderColor: theme.line, color: theme.inkSoft }}>{text}</div>
}

function InlineError({ message }) {
  return <div className="mt-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: '#EACAD2', backgroundColor: '#FFF5F7', color: theme.danger }}>{message}</div>
}

function FullPageStatus({ title = 'Mi Camino EVO', text, actionLabel, onAction }) {
  return (
    <div className="min-h-screen px-5 font-evo-body" style={{ backgroundColor: theme.background, color: theme.ink }}>
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center text-center">
        <BadgeGlyph name="EVO" size="lg" />
        <h1 className="mt-6 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: theme.inkSoft }}>{text}</p>
        {actionLabel ? <button type="button" onClick={onAction} className="mt-6 min-h-12 rounded-2xl px-6 text-sm font-bold text-white" style={{ backgroundColor: theme.purple }}>{actionLabel}</button> : null}
      </div>
    </div>
  )
}

function Svg({ children, className = '', scale = 1, filled = false, viewBox = '0 0 24 24' }) {
  return <svg className={className} width={24 * scale} height={24 * scale} viewBox={viewBox} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
}
function SunIcon(props) { return <Svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41"/></Svg> }
function PathIcon(props) { return <Svg {...props}><path d="M5 19c5 0 2-7 7-7s2-7 7-7"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></Svg> }
function ProgressIcon(props) { return <Svg {...props}><path d="M4 19v-5M10 19V9M16 19v-8M22 19V4"/></Svg> }
function PersonIcon(props) { return <Svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 22c.8-5 3.5-7 8-7s7.2 2 8 7"/></Svg> }
function RefreshIcon(props) { return <Svg {...props}><path d="M20 6v5h-5"/><path d="M19 11a8 8 0 1 0 1 5"/></Svg> }
function ArrowIcon(props) { return <Svg {...props} scale={0.7}><path d="M5 12h14M13 6l6 6-6 6"/></Svg> }
function BoltIcon(props) { return <Svg {...props}><path d="M13 2 4 14h7l-1 8 9-13h-7z"/></Svg> }
function TimerIcon(props) { return <Svg {...props}><circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 13l3-3"/></Svg> }
function GroupIcon(props) { return <Svg {...props}><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M15 15c3 0 5 1.5 6 5"/></Svg> }
function MountainIcon(props) { return <Svg {...props} viewBox="0 0 64 40"><path d="m3 37 18-28 9 14 9-10 22 24"/><path d="M44 13V4l9 3-9 3"/></Svg> }
