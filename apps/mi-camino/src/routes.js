export const MI_CAMINO_ROUTES = Object.freeze({
  TODAY: '/hoy',
  JOURNEY: '/camino',
  EVOLUTION: '/evolucion',
  PROFILE: '/perfil',
  ADMIN: '/admin',
})

const ROUTE_SET = new Set(Object.values(MI_CAMINO_ROUTES))

function normalizePath(pathname = '/') {
  return `/${String(pathname || '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '') || '/'
}

function normalizeBasePath(basePath = '') {
  const normalized = normalizePath(basePath)
  return normalized === '/' ? '' : normalized
}

export function resolveMiCaminoRoute(pathname = '/', basePath = '') {
  const normalizedBasePath = normalizeBasePath(basePath)
  let normalized = normalizePath(pathname)
  if (normalizedBasePath) {
    if (normalized === normalizedBasePath) normalized = '/'
    else if (normalized.startsWith(`${normalizedBasePath}/`)) normalized = normalized.slice(normalizedBasePath.length)
    else return MI_CAMINO_ROUTES.TODAY
  }
  if (normalized === '/') return MI_CAMINO_ROUTES.TODAY
  return ROUTE_SET.has(normalized) ? normalized : MI_CAMINO_ROUTES.TODAY
}

export function miCaminoPath(route, basePath = '') {
  const normalizedBasePath = normalizeBasePath(basePath)
  const resolvedRoute = ROUTE_SET.has(route) ? route : MI_CAMINO_ROUTES.TODAY
  return `${normalizedBasePath}${resolvedRoute}` || MI_CAMINO_ROUTES.TODAY
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
