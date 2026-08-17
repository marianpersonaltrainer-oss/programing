import { describe, expect, it } from 'vitest'
import { MI_CAMINO_ROUTES, miCaminoPath, resolveMiCaminoRoute, routeLabel } from './routes.js'

describe('Mi Camino independent routes', () => {
  it('normaliza las rutas privadas del alumno sin depender de Programming', () => {
    expect(resolveMiCaminoRoute('/')).toBe(MI_CAMINO_ROUTES.TODAY)
    expect(resolveMiCaminoRoute('camino/')).toBe(MI_CAMINO_ROUTES.JOURNEY)
    expect(resolveMiCaminoRoute('/desconocida')).toBe(MI_CAMINO_ROUTES.TODAY)
  })

  it('mantiene la ruta administrativa separada de la experiencia del alumno', () => {
    expect(resolveMiCaminoRoute('/admin')).toBe(MI_CAMINO_ROUTES.ADMIN)
    expect(routeLabel(MI_CAMINO_ROUTES.ADMIN)).toBe('Administración')
  })

  it('funciona bajo la ruta privada de Preview sin interferir con Programming', () => {
    expect(resolveMiCaminoRoute('/mi-camino', '/mi-camino')).toBe(MI_CAMINO_ROUTES.TODAY)
    expect(resolveMiCaminoRoute('/mi-camino/camino', '/mi-camino')).toBe(MI_CAMINO_ROUTES.JOURNEY)
    expect(miCaminoPath(MI_CAMINO_ROUTES.PROFILE, '/mi-camino')).toBe('/mi-camino/perfil')
  })
})
