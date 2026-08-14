import { useCallback, useEffect, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import {
  inviteIdentityCoach,
  listIdentityCoaches,
  setIdentityCoachStatus,
} from '../../lib/identityCoaches.js'

export default function Pe2CoachAdminView() {
  const [coaches, setCoaches] = useState([])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingUserId, setChangingUserId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCoaches(await listIdentityCoaches())
    } catch (nextError) {
      setError(nextError.message || 'No se pudo cargar el equipo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleInvite(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await inviteIdentityCoach({ fullName, email })
      setFullName('')
      setEmail('')
      setNotice('Invitación enviada. El entrenador recibirá un correo para crear su contraseña.')
      await refresh()
    } catch (nextError) {
      setError(nextError.message || 'No se pudo enviar la invitación.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(coach) {
    const nextStatus = coach.status === 'active' ? 'inactive' : 'active'
    if (nextStatus === 'inactive') {
      const confirmed = window.confirm(
        `¿Desactivar el acceso de ${coach.fullName || coach.email || 'este entrenador'}? No se borrará su cuenta y podrás reactivarla después.`,
      )
      if (!confirmed) return
    }

    setChangingUserId(coach.userId)
    setError('')
    setNotice('')
    try {
      await setIdentityCoachStatus(coach.userId, nextStatus)
      setNotice(nextStatus === 'active' ? 'Acceso reactivado.' : 'Acceso desactivado. La cuenta no se ha borrado.')
      await refresh()
    } catch (nextError) {
      setError(nextError.message || 'No se pudo cambiar el acceso.')
    } finally {
      setChangingUserId('')
    }
  }

  return (
    <div className="max-w-4xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
        Administración · Identidad EVO
      </p>
      <h1 className="font-evo-display text-3xl sm:text-4xl font-bold mb-2" style={{ color: evoBrand.text }}>
        Entrenadores
      </h1>
      <p className="text-sm mb-6 max-w-2xl" style={{ color: evoBrand.muted }}>
        Da de alta a cada entrenador con su propio correo. Para una baja, desactiva el acceso: no se borra la cuenta y puede reactivarse más adelante.
      </p>

      {error ? (
        <div className="rounded-xl border px-4 py-3 mb-4 text-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border px-4 py-3 mb-4 text-sm" style={{ backgroundColor: '#ECFDF5', borderColor: '#6EE7B7', color: '#065F46' }}>
          {notice}
        </div>
      ) : null}

      <form
        onSubmit={handleInvite}
        className="rounded-2xl border p-5 mb-6"
        style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}
      >
        <h2 className="font-evo-display text-lg font-bold mb-4" style={{ color: evoBrand.text }}>
          Añadir entrenador
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: evoBrand.muted }}>Nombre</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: `${evoBrand.purple}33` }}
              placeholder="Nombre y apellidos"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: evoBrand.muted }}>Correo electrónico</span>
            <input
              required
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: `${evoBrand.purple}33` }}
              placeholder="entrenador@correo.com"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: evoBrand.accent }}
        >
          {saving ? 'Enviando…' : 'Enviar invitación'}
        </button>
      </form>

      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: `${evoBrand.purple}22` }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: evoBrand.purple }}>Equipo</p>
          <button type="button" onClick={refresh} disabled={loading} className="text-xs font-semibold disabled:opacity-50" style={{ color: evoBrand.muted }}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>

        {!loading && coaches.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center" style={{ color: evoBrand.muted }}>Todavía no hay entrenadores.</p>
        ) : null}

        <ul className="divide-y" style={{ borderColor: `${evoBrand.purple}22` }}>
          {coaches.map((coach) => {
            const active = coach.status === 'active'
            const changing = changingUserId === coach.userId
            return (
              <li key={coach.userId} className="px-4 py-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-sm font-semibold" style={{ color: evoBrand.text }}>{coach.fullName || 'Sin nombre'}</p>
                  <p className="text-xs mt-0.5" style={{ color: evoBrand.muted }}>{coach.email || 'Correo pendiente'}</p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: active ? '#D1FAE5' : '#F3F4F6',
                    color: active ? '#065F46' : '#4B5563',
                  }}
                >
                  {active ? 'Activo' : 'Desactivado'}
                </span>
                <button
                  type="button"
                  onClick={() => handleStatusChange(coach)}
                  disabled={changing}
                  className="px-3 py-2 rounded-xl border text-xs font-semibold disabled:opacity-50"
                  style={{ borderColor: active ? '#FCA5A5' : '#6EE7B7', color: active ? '#991B1B' : '#065F46' }}
                >
                  {changing ? 'Guardando…' : active ? 'Desactivar acceso' : 'Reactivar acceso'}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
