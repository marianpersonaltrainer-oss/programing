import { useEffect, useMemo, useState } from 'react'
import {
  createMiCaminoProjectionEnvelope,
} from '../../../src/domain/miCamino/miCaminoProjectionEnvelope.js'
import {
  getMiCaminoCapabilities,
  getMiCaminoAdminOrganizationId,
  getMiCaminoProjection,
  getMiCaminoSession,
  deactivateMiCaminoAccess,
  isMiCaminoRecoveryLocation,
  isMiCaminoSupabaseConfigured,
  listMiCaminoAccess,
  miCaminoSupabase,
  provisionMiCaminoAccess,
  requestMiCaminoPasswordReset,
  requestMiCaminoMagicLink,
  signInMiCamino,
  signOutMiCamino,
  updateMiCaminoPassword,
} from './miCaminoAuth.js'
import { MI_CAMINO_ROUTES, miCaminoPath, resolveMiCaminoRoute, routeLabel } from './routes.js'
import {
  projectionActionStatusLabel,
  projectionDataStatusLabel,
  projectionProgressPercent,
  projectionStageLabel,
} from './miCaminoPilotView.js'

const DEMO_QUERY_ENABLED = new URLSearchParams(globalThis.location?.search || '').has('demo')
const DEMO_ENABLED = String(import.meta.env.VITE_MI_CAMINO_DEMO_ENABLED || '').toLowerCase() === 'true'
  || DEMO_QUERY_ENABLED
const ADMIN_PILOT_ENABLED = String(import.meta.env.VITE_MI_CAMINO_ADMIN_ENABLED || '').toLowerCase() === 'true'

function emailAccessNotice(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('rate limit')) {
    return 'Por seguridad, espera unos minutos antes de solicitar otro correo. No necesitas hacer nada más ahora.'
  }
  return 'Si tu cuenta EVO está preparada, recibirás un correo seguro. Revisa también la carpeta de spam.'
}

const DEMO_PROJECTION = createMiCaminoProjectionEnvelope({
  projection_id: '018f1f4d-7b6c-7d8e-9f10-111213141540',
  organization_id: '018f1f4d-7b6c-7d8e-9f10-111213141541',
  person_id: '018f1f4d-7b6c-7d8e-9f10-111213141542',
  entry_mode: 'new',
  journey_day: 8,
  stage_key: 'concierge_0_14',
  next_action: {
    action_id: '018f1f4d-7b6c-7d8e-9f10-111213141543',
    kind: 'approved_content',
    title: 'Prepara tu primera semana con calma',
    status: 'available',
    due_at: null,
    reference_id: 'demo:concierge:week-one',
  },
  progress: {
    confirmed_attendance_count: 0,
    completed_action_count: 1,
    total_action_count: 3,
    next_milestone_key: null,
  },
  freshness: {
    status: 'unknown',
    source: 'nucleus',
    source_updated_at: null,
    observed_at: '2026-08-17T09:00:00.000Z',
  },
  updated_at: '2026-08-17T09:00:00.000Z',
})

function Login({ recoveryMode, onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (recoveryMode) {
        await updateMiCaminoPassword(password)
        setNotice('Contraseña actualizada. Ya puedes iniciar sesión.')
        setPassword('')
      } else {
        if (!password) throw new Error('Escribe tu contraseña o usa el enlace por correo.')
        await signInMiCamino(email.trim(), password)
        await onSignedIn()
      }
    } catch (nextError) {
      setError(nextError?.message || 'No se pudo completar el acceso.')
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    setBusy(true)
    setError('')
    try {
      await requestMiCaminoPasswordReset(email.trim())
      setNotice('Revisa tu correo para continuar con la recuperación.')
    } catch (nextError) {
      setNotice(emailAccessNotice(nextError))
    } finally {
      setBusy(false)
    }
  }

  async function requestMagicLink() {
    setBusy(true)
    setError('')
    try {
      await requestMiCaminoMagicLink(email.trim())
      setNotice('Te hemos enviado un enlace seguro. Ábrelo en este mismo navegador para entrar sin contraseña.')
    } catch (nextError) {
      // El mensaje se mantiene neutro para no revelar si una dirección tiene cuenta.
      setNotice(emailAccessNotice(nextError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">EVOLUTION · MI CAMINO</p>
        <h1>{recoveryMode ? 'Nueva contraseña' : 'Tu espacio personal'}</h1>
        <p className="muted">{recoveryMode
          ? 'Elige una contraseña nueva para tu cuenta EVO.'
          : 'Entra con tu cuenta EVO. Solo verás tu propio recorrido.'}</p>
        {notice ? <p className="notice">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!recoveryMode ? (
          <label>Correo electrónico
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
        ) : null}
        <label>Contraseña
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={recoveryMode ? 'new-password' : 'current-password'} minLength={8} required={recoveryMode} />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Un momento…' : recoveryMode ? 'Guardar contraseña' : 'Entrar'}</button>
        {!recoveryMode ? <>
          <button type="button" className="text-button" disabled={busy || !email.trim()} onClick={requestMagicLink}>Entrar con enlace por correo</button>
          <button type="button" className="text-button" disabled={busy || !email.trim()} onClick={resetPassword}>He olvidado mi contraseña</button>
        </> : null}
      </form>
    </main>
  )
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || ''
}

function MiCaminoAdminPilot({ organizationId }) {
  const [rows, setRows] = useState([])
  const [userId, setUserId] = useState('')
  const [personId, setPersonId] = useState('')
  const [journeyDay, setJourneyDay] = useState('0')
  const [actionTitle, setActionTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function refresh() {
    setBusy(true); setError('')
    try { setRows(await listMiCaminoAccess()) } catch { setError('No se pudo leer el piloto ahora.') } finally { setBusy(false) }
  }

  async function provision(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const now = new Date().toISOString()
      await provisionMiCaminoAccess({
        userId: userId.trim(),
        projection: createMiCaminoProjectionEnvelope({
          projection_id: newId(), organization_id: organizationId, person_id: personId.trim(),
          entry_mode: 'new', journey_day: Number(journeyDay), stage_key: 'concierge_0_14',
          next_action: { action_id: newId(), kind: 'approved_content', title: actionTitle.trim(), status: 'available', due_at: null, reference_id: `admin:${newId()}` },
          progress: { confirmed_attendance_count: 0, completed_action_count: 0, total_action_count: 1, next_milestone_key: null },
          freshness: { status: 'unknown', source: 'nucleus', source_updated_at: null, observed_at: now },
          schema_version: 1, updated_at: now,
        }),
      })
      setNotice('Acceso de piloto preparado.'); setActionTitle(''); await refresh()
    } catch (nextError) { setError(nextError?.message || 'No se pudo preparar el acceso.') } finally { setBusy(false) }
  }

  async function deactivate(userIdToDeactivate) {
    setBusy(true); setError(''); setNotice('')
    try { await deactivateMiCaminoAccess(userIdToDeactivate); setNotice('Acceso desactivado, sin borrar la proyección.'); await refresh() } catch { setError('No se pudo desactivar el acceso.') } finally { setBusy(false) }
  }

  return <section className="content-card">
    <p className="eyebrow">ADMINISTRACIÓN · PILOTO 0→30</p><h1>Accesos de Mi Camino</h1>
    <p>Esta consola sólo opera con cuentas EVO existentes y deja la baja como acción reversible. No crea usuarios ni carga datos automáticamente.</p>
    {notice ? <p className="notice">{notice}</p> : null}{error ? <p className="error">{error}</p> : null}
    <form className="admin-form" onSubmit={provision}>
      <label>Id. de cuenta EVO<input value={userId} onChange={(event) => setUserId(event.target.value)} required /></label>
      <label>Id. de persona<input value={personId} onChange={(event) => setPersonId(event.target.value)} required /></label>
      <label>Día de recorrido<input type="number" min="0" max="30" value={journeyDay} onChange={(event) => setJourneyDay(event.target.value)} required /></label>
      <label>Siguiente acción aprobada<input value={actionTitle} onChange={(event) => setActionTitle(event.target.value)} maxLength="160" required /></label>
      <button disabled={busy}>Preparar acceso de piloto</button>
    </form>
    <button type="button" className="text-button" disabled={busy} onClick={refresh}>Actualizar accesos</button>
    {rows.length ? <ul className="access-list">{rows.map((row) => <li key={row.user_id}><span>{row.status === 'active' ? 'Activo' : 'Inactivo'} · cuenta {row.user_id}</span>{row.status === 'active' ? <button type="button" disabled={busy} onClick={() => deactivate(row.user_id)}>Dar de baja</button> : null}</li>)}</ul> : null}
  </section>
}

function PrivateProjection({ route, isAdmin, organizationId, projection, projectionError }) {
  const isAdminRoute = route === MI_CAMINO_ROUTES.ADMIN

  if (isAdminRoute) {
    return isAdmin ? (
      ADMIN_PILOT_ENABLED && organizationId ? <MiCaminoAdminPilot organizationId={organizationId} /> : <section className="content-card"><p className="eyebrow">ADMINISTRACIÓN · PREPARACIÓN</p><h1>Mi Camino 0→30</h1><p>La consola de piloto permanece desactivada hasta validar staging o elegir una única organización. No hay clientes, reglas ni automatizaciones activas todavía.</p></section>
    ) : (
      <section className="content-card"><h1>Sin acceso administrativo</h1><p>Tu cuenta no tiene permiso para esta superficie.</p></section>
    )
  }

  if (!projection) {
    return (
      <section className="content-card">
        <p className="eyebrow">ACCESO PREPARADO</p>
        <h1>Tu Camino estará aquí</h1>
        <p>{projectionError
          ? 'Tu recorrido se está verificando de forma segura. Vuelve a intentarlo más tarde.'
          : 'La experiencia privada se activa cuando tu recorrido esté preparado. No mostramos información inventada ni datos de otra persona.'}</p>
      </section>
    )
  }

  if (route === MI_CAMINO_ROUTES.JOURNEY) {
    return <section className="content-card"><p className="eyebrow">MI CAMINO</p><h1>{projectionStageLabel(projection)}</h1><p>Etapa actual: {projection.stage_key}.</p><p className="small-muted">La información procede de tu recorrido privado de EVO.</p></section>
  }
  if (route === MI_CAMINO_ROUTES.EVOLUTION) {
    const percentage = projectionProgressPercent(projection)
    return <section className="content-card"><p className="eyebrow">EVOLUCIÓN</p><h1>Progreso claro, sin comparaciones</h1><p>Acciones completadas: {projection.progress.completed_action_count} de {projection.progress.total_action_count}.</p><div className="progress-track" aria-label={`${percentage}% de acciones completadas`}><span style={{ width: `${percentage}%` }} /></div><p className="small-muted">{percentage}% del recorrido preparado hasta ahora.</p></section>
  }
  if (route === MI_CAMINO_ROUTES.PROFILE) {
    return <section className="content-card"><p className="eyebrow">PERFIL</p><h1>Tu cuenta EVO</h1><p>Los datos del perfil se habilitarán desde una fuente privada validada.</p></section>
  }
  return (
    <section className="content-card hero-card">
      <p className="eyebrow">HOY · {projectionStageLabel(projection)}</p>
      <h1>{projection.next_action.title}</h1>
      <p>Un solo siguiente paso, seleccionado para tu recorrido. Sin presión, comparaciones ni datos de salud.</p>
      <p className="next-step">Estado: {projectionActionStatusLabel(projection.next_action.status)}.</p>
      <p className="small-muted">Estado de datos: {projectionDataStatusLabel(projection.freshness.status)}.</p>
    </section>
  )
}

export default function App({ basePath = '' }) {
  const [session, setSession] = useState(null)
  const [capabilities, setCapabilities] = useState([])
  const [organizationId, setOrganizationId] = useState(null)
  const [projection, setProjection] = useState(DEMO_ENABLED ? DEMO_PROJECTION : null)
  const [projectionError, setProjectionError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState(() => resolveMiCaminoRoute(globalThis.location?.pathname, basePath))
  const recoveryMode = isMiCaminoRecoveryLocation()

  async function refreshIdentity() {
    const nextSession = await getMiCaminoSession()
    setSession(nextSession)
    const nextCapabilities = nextSession ? await getMiCaminoCapabilities() : []
    setCapabilities(nextCapabilities)
    setOrganizationId(nextSession ? await getMiCaminoAdminOrganizationId() : null)
    if (!nextSession || DEMO_ENABLED) {
      setProjection(DEMO_ENABLED ? DEMO_PROJECTION : null)
      setProjectionError(false)
      return
    }
    if (!nextCapabilities.includes('mi_camino.read_own') && !nextCapabilities.includes('mi_camino.manage')) {
      setProjection(null)
      setProjectionError(false)
      return
    }
    try {
      setProjection(createMiCaminoProjectionEnvelope(await getMiCaminoProjection()))
      setProjectionError(false)
    } catch {
      setProjection(null)
      setProjectionError(true)
    }
  }

  useEffect(() => {
    if (!isMiCaminoSupabaseConfigured) {
      setLoading(false)
      return undefined
    }
    refreshIdentity().catch(() => {}).finally(() => setLoading(false))
    const { data } = miCaminoSupabase.auth.onAuthStateChange(() => {
      globalThis.setTimeout(() => {
        refreshIdentity().catch(() => {})
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const isAdmin = useMemo(() => capabilities.includes('mi_camino.manage'), [capabilities])
  const nav = [
    MI_CAMINO_ROUTES.TODAY,
    MI_CAMINO_ROUTES.JOURNEY,
    MI_CAMINO_ROUTES.EVOLUTION,
    MI_CAMINO_ROUTES.PROFILE,
    ...(isAdmin ? [MI_CAMINO_ROUTES.ADMIN] : []),
  ]

  function navigate(nextRoute) {
    const demoQuery = DEMO_QUERY_ENABLED ? '?demo=1' : ''
    window.history.pushState({}, '', `${miCaminoPath(nextRoute, basePath)}${demoQuery}`)
    setRoute(nextRoute)
  }

  if (!isMiCaminoSupabaseConfigured) {
    return <main className="auth-shell"><section className="auth-card"><h1>Mi Camino está preparando su acceso</h1><p className="muted">Falta conectar el entorno privado de EVO. No se ha cargado ningún dato.</p></section></main>
  }
  if (loading) return <main className="auth-shell"><p>Cargando tu acceso…</p></main>
  if (!session || recoveryMode) return <Login recoveryMode={recoveryMode} onSignedIn={refreshIdentity} />

  return (
    <main className="app-shell">
      <header><div><p className="eyebrow">EVOLUTION</p><strong>Mi Camino</strong>{DEMO_ENABLED ? <p className="preview-role">Vista de prueba · cliente ficticio</p> : null}</div><button className="text-button" type="button" onClick={() => signOutMiCamino()}>Cerrar sesión</button></header>
      <nav aria-label="Mi Camino">{nav.map((item) => <button key={item} type="button" className={item === route ? 'active' : ''} onClick={() => navigate(item)}>{routeLabel(item)}</button>)}</nav>
      <PrivateProjection route={route} isAdmin={isAdmin} organizationId={organizationId} projection={projection} projectionError={projectionError} />
    </main>
  )
}
