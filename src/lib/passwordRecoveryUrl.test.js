import { describe, expect, it } from 'vitest'
import { isPasswordRecoveryLocation } from './passwordRecoveryUrl.js'

describe('password recovery routing', () => {
  it('reconoce la ruta explicita de recuperacion de PE2', () => {
    expect(isPasswordRecoveryLocation({
      search: '?v2&reset-password=1',
      hash: '',
    })).toBe(true)
  })

  it('reconoce el fragmento de recuperacion de Supabase antes de que se consuma', () => {
    expect(isPasswordRecoveryLocation({
      search: '',
      hash: '#access_token=redacted&type=recovery',
    })).toBe(true)
  })

  it('no confunde una sesion o una ruta ordinaria con recuperacion', () => {
    expect(isPasswordRecoveryLocation({ search: '?v2', hash: '' })).toBe(false)
    expect(isPasswordRecoveryLocation({
      search: '',
      hash: '#access_token=redacted&type=signup',
    })).toBe(false)
  })
})
