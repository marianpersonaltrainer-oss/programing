# ProgramingEvo — Setup

## Requisitos
- Node.js 18 o superior → https://nodejs.org

## Instalación

```bash
# Entra en la carpeta del proyecto
cd programingevo

# Instala dependencias
npm install

# Crea el archivo de configuración
cp .env.example .env
```

## Configurar API key

Abre el archivo `.env` y añade tu API key de Anthropic:

```
VITE_ANTHROPIC_API_KEY=sk-ant-XXXXXXXXXX
```

> La API key la encuentras en https://console.anthropic.com

## Ejecutar en desarrollo

```bash
npm run dev
```

Abre el navegador en: http://localhost:5173

## Build para producción

```bash
npm run build
npm run preview
```
