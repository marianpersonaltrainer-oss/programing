# Uso de la API de Anthropic en ProgramingEvo

Referencia para **qué llama**, **qué modelo** usa y **órdenes de magnitud de tokens** (orientativos). Los importes reales dependen del modelo, de la tabla de precios vigente y del uso medido en [Anthropic Console](https://console.anthropic.com).

## Resumen por llamada

| Función / flujo | Archivo | Modelo (por defecto) | Motivo | Tokens por llamada (estimación) |
|-----------------|---------|----------------------|--------|-----------------------------------|
| Generador semanal Excel | `ExcelGeneratorModal.jsx` → `callApi` | `claude-sonnet-4-20250514` (`VITE_CLAUDE_MODEL`) | Generar JSON de programación con `SYSTEM_PROMPT_EXCEL`; máxima calidad. | **Entrada:** ~8 000–25 000 (system largo + contexto subido + historial + instrucciones; la 2.ª llamada incluye JSON parcial). **Salida:** hasta 8 000 (techo `maxTokens`); en la práctica a menudo 3 000–7 000 por mitad de semana. |
| Agente chat programador | `useAgent.js` → `sendMessage` | Mismo Sonnet | Iterar sesiones con `SYSTEM_PROMPT` + contexto de la semana; historial completo en cada POST. | **Entrada:** crece con el chat (system + contexto + *todos* los turnos); típico **~4 000–30 000+** según conversación. **Salida:** hasta 8 000; respuestas habituales más cortas. |
| Chat soporte coach | `CoachView.jsx` (pestaña Soporte) | `claude-haiku-4-5-20251001` (`VITE_CLAUDE_SUPPORT_MODEL`) | Dudas cortas; prompt fijo `systemPromptCoachSupport.js`; coste bajo. | **Entrada:** ~1 500–5 000 (system + historial del hilo). **Salida:** hasta 1 024 (`coachMaxTokens`); alineado con respuestas breves. |

## Llamadas por acción de usuario

- **“Generar semana completa → Excel”:** **2** llamadas Sonnet consecutivas (`callApi` parte 1 y parte 2).
- **Cada mensaje en el chat del programador:** **1** llamada Sonnet.
- **Cada mensaje en el chat de soporte (coach):** **1** llamada Haiku (hasta **10** por día y dispositivo; ver lógica en `CoachView.jsx`).

## Proxy serverless

- **`api/anthropic.js`:** recibe el `model` del cliente y reenvía a `https://api.anthropic.com/v1/messages`. La clave `ANTHROPIC_API_KEY` solo existe en el servidor (Vercel).

## Variables de entorno relacionadas

| Variable | Uso |
|----------|-----|
| `ANTHROPIC_API_KEY` | Servidor; obligatoria para cualquier llamada. |
| `VITE_CLAUDE_MODEL` | Opcional; override del Sonnet para Excel + `useAgent`. |
| `VITE_CLAUDE_SUPPORT_MODEL` | Opcional; override del Haiku para el chat coach. |

## Nota

Las estimaciones son **aproximadas** (cuentan caracteres/palabras de forma conceptual). Para presupuesto, usa el desglose de uso y facturación en la consola de Anthropic y la [página de precios](https://www.anthropic.com/pricing) del modelo concreto.
