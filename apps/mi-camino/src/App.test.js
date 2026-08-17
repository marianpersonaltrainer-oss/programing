import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const auth = readFileSync(new URL('./miCaminoAuth.js', import.meta.url), 'utf8')

describe('Mi Camino independent identity boundary', () => {
  it('reutiliza la sesión EVO y las capabilities, sin profiles.role', () => {
    expect(auth).toContain(".rpc('evo_my_capabilities')")
    expect(app).toContain("'mi_camino.manage'")
    expect(app).not.toContain('profiles.role')
    expect(auth).not.toContain(".from('profiles')")
  })

  it('lee únicamente la proyección protegida y valida el contrato antes de mostrarla', () => {
    expect(auth).toContain(".from('mi_camino_projections')")
    expect(auth).not.toContain('mi_camino_person_access')
    expect(app).toContain('createMiCaminoProjectionEnvelope(await getMiCaminoProjection())')
    expect(app).toContain('Tu recorrido se está verificando de forma segura')
  })

  it('deja el demo explícito y no incluye datos reales en el bundle', () => {
    expect(app).toContain('VITE_MI_CAMINO_DEMO_ENABLED')
    expect(app).toContain("DEMO_ENABLED ? DEMO_PROJECTION : null")
    expect(app).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(app).not.toContain('ANTHROPIC_API_KEY')
  })

  it('permite acceso sin contraseña solo mediante enlace para cuentas existentes', () => {
    expect(app).toContain('Entrar con enlace por correo')
    expect(auth).toContain('signInWithOtp')
    expect(auth).toContain('shouldCreateUser: false')
    expect(auth).toContain("'/mi-camino'")
  })

  it('convierte los límites temporales de correo en una instrucción clara y segura', () => {
    expect(app).toContain('espera unos minutos antes de solicitar otro correo')
    expect(app).toContain('emailAccessNotice')
  })

  it('muestra solamente la acción y progreso contenidos en la proyección P2 validada', () => {
    expect(app).toContain('projectionProgressPercent(projection)')
    expect(app).toContain('projection.next_action.title')
    expect(app).toContain('Sin presión, comparaciones ni datos de salud')
  })
})
