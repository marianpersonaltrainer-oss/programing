/** Inyectado en build (git SHA corto). Sirve para confirmar que la preview no está cacheada. */
export const EVO_BUILD_ID = typeof __EVO_BUILD_ID__ !== 'undefined' ? __EVO_BUILD_ID__ : 'dev'
