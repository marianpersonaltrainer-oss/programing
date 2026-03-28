# ProgramingEvo — Setup

## Requisitos

- **Node.js 20.x** (coincide con `engines` en `package.json`) → https://nodejs.org

## Instalación

```bash
cd programingevo
npm install
cp .env.example .env
```

## Variables de entorno

Edita `.env` con:

| Variable | Dónde se usa |
|----------|----------------|
| `ANTHROPIC_API_KEY` | Solo en la función serverless `api/anthropic.js` (Vercel o `vercel dev`). No uses prefijo `VITE_`: así la clave no entra en el JavaScript del navegador. |
| `VITE_SUPABASE_URL` | Cliente (modo coach, publicar semana). |
| `VITE_SUPABASE_ANON_KEY` | Cliente (mismo uso que la URL). |

Opcional en el cliente: `VITE_CLAUDE_MODEL` (por defecto `claude-sonnet-4-20250514`). El antiguo `claude-3-5-sonnet-20241022` ya no existe en la API de Anthropic.

La clave de Anthropic está en https://console.anthropic.com

## Desarrollo

**Solo interfaz (sin llamadas a `/api/anthropic`):**

```bash
npm run dev
```

Abre http://localhost:5173

**Con chat IA y generador Excel funcionando** hace falta ejecutar las funciones serverless locales. Usa la CLI de Vercel (lee `ANTHROPIC_API_KEY` del `.env` para la API):

```bash
npx vercel dev
```

## Build para producción

```bash
npm run build
npm run preview
```

En **Vercel**, define `ANTHROPIC_API_KEY` y las variables `VITE_*` en el panel del proyecto (Production / Preview). No marques `ANTHROPIC_API_KEY` como variable expuesta al cliente.
