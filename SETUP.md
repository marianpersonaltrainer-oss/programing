# ProgramingEvo — Setup

## Requisitos

- **Node.js 22.x** (coincide con `engines` en `package.json`) → https://nodejs.org

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
| `OPENAI_API_KEY` | Solo en las funciones serverless (Vercel o `vercel dev`). No uses prefijo `VITE_`: así la clave no entra en el JavaScript del navegador. |
| `VITE_SUPABASE_URL` | Cliente (modo coach, publicar semana). |
| `VITE_SUPABASE_ANON_KEY` | Cliente (mismo uso que la URL). |

Opcional: `VITE_OPENAI_MODEL` y `VITE_OPENAI_SUPPORT_MODEL`. Claude solo puede habilitarse como respaldo con `AI_ANTHROPIC_FALLBACK=true` y `ANTHROPIC_API_KEY`.

## Desarrollo

**Solo interfaz (sin llamadas a las funciones IA):**

```bash
npm run dev
```

Abre http://localhost:5173

**Con chat IA y generador Excel funcionando** hace falta ejecutar las funciones serverless locales. Usa la CLI de Vercel (lee `OPENAI_API_KEY` del `.env` solo en servidor):

```bash
npx vercel dev
```

## Build para producción

```bash
npm run build
npm run preview
```

En **Vercel**, define `OPENAI_API_KEY` y las variables `VITE_*` en el panel del proyecto (Production / Preview). No marques `OPENAI_API_KEY` como variable expuesta al cliente.
