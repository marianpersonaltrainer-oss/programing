import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const login = readFileSync(new URL('./Pe2Login.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../../Pe2App.jsx', import.meta.url), 'utf8')
const auth = readFileSync(new URL('../../lib/pe2Auth.js', import.meta.url), 'utf8')
const appShell = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')
const authHook = readFileSync(new URL('../../hooks/usePe2Auth.js', import.meta.url), 'utf8')

describe('PE2 password recovery', () => {
  it('ofrece recuperación sin incluir contraseñas o tokens en la URL', () => {
    expect(login).toContain('He olvidado mi contraseña')
    expect(auth).toContain('resetPasswordForEmail')
    expect(auth).toContain('updateUser')
    expect(auth).not.toContain('access_token=')
    expect(auth).not.toContain('password=')
  })

  it('prioriza la pantalla de recuperación aunque exista sesión temporal', () => {
    expect(app).toContain('!auth.isAuthenticated || auth.recoveryMode')
    expect(appShell).toContain('isPasswordRecoveryLocation(window.location)')
    expect(authHook).toContain('isPasswordRecoveryLocation(globalThis.location)')
    expect(login).toContain('autoComplete="new-password"')
    expect(login).toContain('minLength={8}')
  })

  it('no precarga datos personales en el formulario de acceso', () => {
    expect(login).toContain("const [email, setEmail] = useState('')")
    expect(login).not.toContain('marianpersonaltrainer@gmail.com')
  })
})
