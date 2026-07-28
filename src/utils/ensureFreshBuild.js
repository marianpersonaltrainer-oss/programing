import { EVO_BUILD_ID } from '../constants/evoBuildId.js'

const STORAGE_KEY = 'evo_deploy_build_id'

/**
 * Tras un deploy nuevo, fuerza una recarga limpia (sin service worker antiguo).
 * El briefing guardado en localStorage se conserva; solo se actualiza el JS.
 */
export async function ensureFreshBuild() {
  if (!import.meta.env.PROD) return
  try {
    const previous = localStorage.getItem(STORAGE_KEY)
    if (previous && previous !== EVO_BUILD_ID) {
      localStorage.setItem(STORAGE_KEY, EVO_BUILD_ID)
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((reg) => reg.unregister()))
      }
      const url = new URL(window.location.href)
      url.searchParams.set('v', EVO_BUILD_ID)
      window.location.replace(url.toString())
      return
    }
    if (!previous) localStorage.setItem(STORAGE_KEY, EVO_BUILD_ID)
  } catch {
    /* storage bloqueado */
  }
}
