import { useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'

function PasswordVisibilityToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#A729AD]/40"
      style={{ color: evoBrand.purple }}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={visible}
      title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    >
      {visible ? 'Ocultar' : 'Ver'}
    </button>
  )
}

export default function Pe2Login({
  onSignIn,
  onRequestPasswordReset,
  onUpdatePassword,
  recoveryMode,
  loading,
  error,
  eyebrow = 'ProgramingEvo V2',
  description = 'Acceso con Supabase Auth. Programadores entran al módulo de programación; coaches a Sala (Fase 2).',
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [passwordUpdated, setPasswordUpdated] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    await onSignIn(email.trim(), password)
  }

  async function handleRequestReset() {
    setResetting(true)
    try {
      await onRequestPasswordReset(email.trim())
      setResetSent(true)
    } finally {
      setResetting(false)
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault()
    await onUpdatePassword(password)
    setPassword('')
    setPasswordUpdated(true)
  }

  const inputStyle = {
    backgroundColor: '#FFFFFF',
    borderColor: `${evoBrand.purple}33`,
    color: evoBrand.text,
  }

  if (recoveryMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: evoBrand.app }}>
        <form
          onSubmit={handleUpdatePassword}
          className="w-full max-w-md rounded-2xl border p-8 shadow-sm"
          style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}
        >
          <h1 className="font-evo-display text-2xl font-bold mb-2" style={{ color: evoBrand.text }}>
            Nueva contraseña
          </h1>
          <p className="text-sm mb-6" style={{ color: evoBrand.muted }}>
            Escribe una contraseña nueva de al menos 8 caracteres.
          </p>
          {passwordUpdated ? (
            <div className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ backgroundColor: '#ECFDF5', borderColor: '#6EE7B7', color: '#065F46' }}>
              Contraseña actualizada. Ya puedes volver a iniciar sesión.
            </div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>
              {error}
            </div>
          ) : null}
          <div className="relative mb-6">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-20 rounded-xl border text-sm"
              style={inputStyle}
              minLength={8}
              required
              autoComplete="new-password"
            />
            <PasswordVisibilityToggle visible={showPassword} onToggle={() => setShowPassword((current) => !current)} />
          </div>
          <button
            type="submit"
            disabled={loading || passwordUpdated}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: evoBrand.accent }}
          >
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: evoBrand.app }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border p-8 shadow-sm"
        style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
          {eyebrow}
        </p>
        <h1 className="font-evo-display text-2xl font-bold mb-2" style={{ color: evoBrand.text }}>
          Iniciar sesión
        </h1>
        <p className="text-sm mb-6" style={{ color: evoBrand.muted }}>
          {description}
        </p>

        {error ? (
          <div className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>
            {error}
          </div>
        ) : null}

        <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: evoBrand.purple }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-3 py-2.5 rounded-xl border text-sm"
          style={inputStyle}
          required
          autoComplete="email"
        />

        <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: evoBrand.purple }}>
          Contraseña
        </label>
        <div className="relative mb-6">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 pr-20 rounded-xl border text-sm"
            style={inputStyle}
            required
            autoComplete="current-password"
          />
          <PasswordVisibilityToggle visible={showPassword} onToggle={() => setShowPassword((current) => !current)} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: evoBrand.accent }}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        <button
          type="button"
          disabled={resetting || !email.trim()}
          onClick={handleRequestReset}
          className="w-full mt-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ color: evoBrand.purple }}
        >
          {resetting ? 'Enviando…' : 'He olvidado mi contraseña'}
        </button>
        {resetSent ? (
          <p className="mt-3 text-sm text-center" style={{ color: evoBrand.muted }}>
            Revisa tu correo y abre el enlace de recuperación.
          </p>
        ) : null}
      </form>
    </div>
  )
}
