import { useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'

export default function Pe2Login({ onSignIn, loading, error }) {
  const [email, setEmail] = useState('marianpersonaltrainer@gmail.com')
  const [password, setPassword] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    await onSignIn(email.trim(), password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: evoBrand.app }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border p-8 shadow-sm"
        style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
          ProgramingEvo V2
        </p>
        <h1 className="font-evo-display text-2xl font-bold mb-2" style={{ color: evoBrand.text }}>
          Iniciar sesión
        </h1>
        <p className="text-sm mb-6" style={{ color: evoBrand.muted }}>
          Acceso con Supabase Auth. Programadores entran al módulo de programación; coaches a Sala (Fase 2).
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
          style={{ borderColor: `${evoBrand.purple}33` }}
          required
          autoComplete="email"
        />

        <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: evoBrand.purple }}>
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 px-3 py-2.5 rounded-xl border text-sm"
          style={{ borderColor: `${evoBrand.purple}33` }}
          required
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: evoBrand.accent }}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
