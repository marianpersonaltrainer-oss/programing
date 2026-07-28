import { EVO_BUILD_ID } from '../constants/evoBuildId.js'

export const EVO_BUILD_GUARD_STORAGE_KEY = 'evo_deploy_build_id'

function readServerBuildIdFromDom() {
  return document.querySelector('meta[name="evo-build-id"]')?.getAttribute('content')?.trim() || ''
}

/**
 * Tras un deploy nuevo, fuerza una recarga limpia (sin service worker antiguo).
 * El briefing guardado en localStorage se conserva; solo se actualiza el JS.
 * El guard inline en index.html corre antes; esto es respaldo por si el bundle quedó cacheado.
 */
export async function ensureFreshBuild() {
  if (!import.meta.env.PROD) return
  try {
    const serverBuildId = readServerBuildIdFromDom()
    const targetBuildId = serverBuildId || EVO_BUILD_ID
    const previous = localStorage.getItem(EVO_BUILD_GUARD_STORAGE_KEY)
    if (previous && previous !== targetBuildId) {
      localStorage.setItem(EVO_BUILD_GUARD_STORAGE_KEY, targetBuildId)
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((reg) => reg.unregister()))
      }
      const url = new URL(window.location.href)
      url.searchParams.set('v', targetBuildId)
      window.location.replace(url.toString())
      return
    }
    if (!previous) localStorage.setItem(EVO_BUILD_GUARD_STORAGE_KEY, targetBuildId)
    if (serverBuildId && EVO_BUILD_ID && serverBuildId !== EVO_BUILD_ID) {
      localStorage.setItem(EVO_BUILD_GUARD_STORAGE_KEY, serverBuildId)
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((reg) => reg.unregister()))
      }
      const url = new URL(window.location.href)
      url.searchParams.set('v', serverBuildId)
      window.location.replace(url.toString())
    }
  } catch {
    /* storage bloqueado */
  }
}
