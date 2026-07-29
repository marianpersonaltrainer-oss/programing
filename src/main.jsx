import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ensureFreshBuild } from './utils/ensureFreshBuild.js'

async function bootstrap() {
  await ensureFreshBuild()
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    void ensureFreshBuild()
  }
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'EVO_SW_ACTIVATED') {
      window.location.reload()
    }
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing
          if (!w) return
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload()
            }
          })
        })
      })
      .catch(() => {})
  })
}
