import { EVO_BUILD_ID } from '../constants/evoBuildId.js'

export const EVO_BUILD_GUARD_STORAGE_KEY = 'evo_deploy_build_id'

function readDomBuildId() {
  return document.querySelector('meta[name="evo-build-id"]')?.getAttribute('content')?.trim() || ''
}

/** Consulta el HTML en red (sin caché) para saber qué build sirve Vercel ahora. */
export async function fetchServerBuildId() {
  const res = await fetch(`${window.location.origin}/?_evo_build=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'text/html' },
  })
  if (!res.ok) return ''
  const html = await res.text()
  const match = html.match(/<meta name="evo-build-id" content="([^"]+)"/i)
  return match?.[1]?.trim() || ''
}

async function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((reg) => reg.unregister()))
}

function reloadForBuild(buildId) {
  try {
    localStorage.setItem(EVO_BUILD_GUARD_STORAGE_KEY, buildId)
  } catch {
    /* storage bloqueado */
  }
  const url = new URL(window.location.href)
  url.searchParams.set('v', buildId)
  url.searchParams.set('_', String(Date.now()))
  window.location.replace(url.toString())
}

/**
 * Tras un deploy nuevo, fuerza recarga limpia comparando el bundle con el HTML en red.
 * El briefing en localStorage se conserva; solo se actualiza el JS.
 */
export async function ensureFreshBuild() {
  if (!import.meta.env.PROD) return
  try {
    const domBuildId = readDomBuildId()
    const serverBuildId = await fetchServerBuildId()
    const targetBuildId = serverBuildId || domBuildId || EVO_BUILD_ID
    const previous = localStorage.getItem(EVO_BUILD_GUARD_STORAGE_KEY)

    if (serverBuildId && EVO_BUILD_ID && serverBuildId !== EVO_BUILD_ID) {
      await unregisterServiceWorkers()
      reloadForBuild(serverBuildId)
      return
    }

    if (serverBuildId && domBuildId && serverBuildId !== domBuildId) {
      await unregisterServiceWorkers()
      reloadForBuild(serverBuildId)
      return
    }

    if (previous && targetBuildId && previous !== targetBuildId) {
      await unregisterServiceWorkers()
      reloadForBuild(targetBuildId)
      return
    }

    if (!previous && targetBuildId) {
      localStorage.setItem(EVO_BUILD_GUARD_STORAGE_KEY, targetBuildId)
    }
  } catch {
    /* red o storage bloqueado */
  }
}
