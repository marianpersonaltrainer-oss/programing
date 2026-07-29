import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

function resolveBuildId() {
  const fromVercel = String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim().slice(0, 7)
  if (fromVercel) return fromVercel
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

const EVO_BUILD_ID = resolveBuildId()
const EVO_BUILD_GUARD_STORAGE_KEY = 'evo_deploy_build_id'

function evoBuildMetaPlugin(buildId) {
  return {
    name: 'evo-build-meta',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta name="evo-build-id" content="${buildId}" />`,
      )
    },
  }
}

/** No cargar el bundle hasta comprobar en red que coincide con el deploy actual. */
function evoDeferredAppLoaderPlugin() {
  return {
    name: 'evo-deferred-app-loader',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const moduleMatch = html.match(
          /<script type="module" crossorigin src="(\/assets\/index-[^"]+\.js)"><\/script>/,
        )
        if (!moduleMatch) return html

        const appSrc = moduleMatch[1]
        const script = `<script id="evo-app-loader">(function(){var FALLBACK_SRC=${JSON.stringify(appSrc)};var KEY=${JSON.stringify(EVO_BUILD_GUARD_STORAGE_KEY)};function reload(id){try{localStorage.setItem(KEY,id);}catch(e){}var u=new URL(location.href);u.searchParams.set("v",id);u.searchParams.set("_",String(Date.now()));location.replace(u.toString());}function loadApp(src,buildId){var s=document.createElement("script");s.type="module";s.crossOrigin="anonymous";s.src=src+(src.indexOf("?")>=0?"&":"?")+"b="+encodeURIComponent(buildId||"");document.head.appendChild(s);}function maybeReload(server,local,prev,serverSrc,localSrc){if(!server)return false;if(server!==local||(prev&&prev!==server)||(serverSrc&&localSrc&&serverSrc!==localSrc)){if("serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(x){return x.unregister();}));}).then(function(){reload(server);});return true;}reload(server);return true;}if(!prev){try{localStorage.setItem(KEY,server);}catch(e){}}return false;}fetch(location.origin+"/?_evo="+Date.now(),{cache:"no-store",credentials:"same-origin",headers:{Accept:"text/html"}}).then(function(r){return r.text();}).then(function(html){var m=html.match(/meta name="evo-build-id" content="([^"]+)"/);var server=m&&m[1]?m[1].trim():"";var local=(document.querySelector('meta[name="evo-build-id"]')||{}).content||"";var sm=html.match(/script type="module" crossorigin src="(\\/assets\\/index-[^"]+\\.js)"/);var serverSrc=sm&&sm[1]?sm[1]:FALLBACK_SRC;var prev=null;try{prev=localStorage.getItem(KEY);}catch(e){}if(maybeReload(server,local,prev,serverSrc,FALLBACK_SRC))return;loadApp(serverSrc,server);}).catch(function(){loadApp(FALLBACK_SRC,"");});})();</script>`

        return html.replace(moduleMatch[0], script)
      },
    },
  }
}

/**
 * No importar `package.json` aquí con assert JSON: al empaquetar la config, esbuild puede resolver
 * rutas relativas tipo `../../package.json` desde este directorio; un JSON inválido fuera del repo rompe el build.
 * Versión/nombre del proyecto: duplicar en este archivo solo si hiciera falta para plugins.
 *
 * nodePolyfills: ExcelJS necesita en navegador los polyfills de Node (process/stream/buffer); sin ellos
 * `wb.xlsx.load()` falla al parsear el workbook («Cannot read properties of undefined (reading 'sheets')»).
 */
export default defineConfig({
  plugins: [
    evoBuildMetaPlugin(EVO_BUILD_ID),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
    }),
    react(),
    evoDeferredAppLoaderPlugin(),
  ],
  define: {
    'process.browser': 'true',
    __EVO_BUILD_ID__: JSON.stringify(EVO_BUILD_ID),
  },
})
