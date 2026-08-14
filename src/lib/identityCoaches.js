import { supabase } from './supabase.js'

const ERROR_MESSAGES = Object.freeze({
  authentication_required: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  capability_denied: 'Tu cuenta no tiene permiso para gestionar entrenadores.',
  organization_context_required: 'Selecciona una organización antes de continuar.',
  user_already_registered: 'Ese correo ya tiene una cuenta. Si aparece abajo, reactiva su acceso.',
  invalid_invite: 'Revisa el nombre y el correo electrónico.',
  rate_limit_exceeded: 'Demasiadas operaciones seguidas. Espera unos minutos.',
  identity_read_unavailable: 'No se pudo cargar el equipo en este momento.',
  identity_write_unavailable: 'No se pudo guardar el cambio. No se ha borrado ninguna cuenta.',
  invite_failed: 'Supabase no pudo enviar la invitación.',
})

async function postIdentityAction(payload) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new Error(ERROR_MESSAGES.authentication_required)
  }

  const response = await fetch('/api/identity-coaches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(ERROR_MESSAGES[json.error] || 'No se pudo completar la operación.')
  }
  return json
}

export async function listIdentityCoaches() {
  const result = await postIdentityAction({ action: 'list' })
  return result.coaches || []
}

export async function inviteIdentityCoach({ fullName, email }) {
  return postIdentityAction({ action: 'invite', fullName, email })
}

export async function setIdentityCoachStatus(userId, status) {
  return postIdentityAction({ action: 'set_status', userId, status })
}
