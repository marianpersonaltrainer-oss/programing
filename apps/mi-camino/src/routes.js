export const MI_CAMINO_ROUTES = Object.freeze({
  TODAY: '/hoy',
  JOURNEY: '/camino',
  EVOLUTION: '/evolucion',
  PROFILE: '/perfil',
  ADMIN: '/admin',
})

const ROUTE_SET = new Set(Object.values(MI_CAMINO_ROUTES))

export function resolveMiCaminoRoute(pathname = '/') {
  const normalized = `/${String(pathname || '/').replace(/^\/+|\/+$/g, '')}`
  if (normalized === '/') return MI_CAMINO_ROUTES.TODAY
  return ROUTE_SET.has(normalized) ? normalized : MI_CAMINO_ROUTES.TODAY
}

export function routeLabel(route) {
  return {
    [MI_CAMINO_ROUTES.TODAY]: 'Hoy',
    [MI_CAMINO_ROUTES.JOURNEY]: 'Mi camino',
    [MI_CAMINO_ROUTES.EVOLUTION]: 'Evolución',
    [MI_CAMINO_ROUTES.PROFILE]: 'Perfil',
    [MI_CAMINO_ROUTES.ADMIN]: 'Administración',
  }[route] || 'Hoy'
}
