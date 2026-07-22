# Saneamiento de la app EVO — 22 de julio de 2026

## Objetivo

Dejar la aplicación con una fuente de verdad comprensible, retirar restos que ya no participan en ningún flujo y asegurar que tanto la programación como la información que recibe el entrenador responden al Método EVO vigente.

Este trabajo no borra datos remotos, no modifica semanas publicadas y no despliega producción.

## Jerarquía de autoridad

| Prioridad | Fuente | Uso |
|---|---|---|
| 1 | `src/domain/method/methodEvoV1.json` y su proyección en `methodEvoV1.js` | Método canónico, identidades, contrato de salida, feedback y validadores |
| 2 | Decisiones manuales confirmadas por Marian | Preferencias subordinadas; nunca pueden sustituir un no negociable |
| 3 | Semana activa, mesociclo, oferta e inventario | Contexto operativo de la generación o de la consulta del coach |
| 4 | Feedback real, check-ins y programación histórica | Evidencia para corregir decisiones y evitar repeticiones |
| 5 | Documentos importados de Drive | Referencia; no crean reglas ni modifican el método |
| 6 | Observaciones recogidas al editar | Pendientes de revisión; no llegan a la IA |

La tabla `method_rules` antigua queda fuera del código. Si todavía existe en Supabase, sus filas no se leen ni se escriben desde la aplicación.

## Superficies activas

| Ruta | Función | Estado |
|---|---|---|
| `/` | Programador por chat y generador semanal | Principal |
| `/?coach` | Vista del entrenador, feedback, semana y asistente de sala | Principal |
| `/?v2` | Prototipo estructurado PE2 | Experimental y aislado |

Las tres superficies se cargan por separado. Los modales administrativos, la exportación Excel y las vistas secundarias se descargan solo cuando se abren.

## Programación y feedback

- Chat, generador semanal, edición diaria y briefing semanal usan el mismo constructor del Método EVO.
- La oferta se elige en una única parrilla día × modalidad antes de generar. Se guarda dentro del JSON semanal y manda en generación, revisión y publicación; un día sin clases no se envía a la IA.
- El contrato visible comienza en `A)`, `B)`, `C)` o `PARTE ÚNICA`; la preparación de la hora se calcula, pero no se publica.
- EvoFit se define por menor complejidad técnica, no por menor exigencia: fuerza real, accesorios y WOD/acondicionamiento.
- El feedback es un párrafo natural de 3–5 frases y 35–90 palabras. Explica primero qué buscamos y cómo debe sentirse la sesión; después añade solo la decisión práctica que ayuda al coach.
- Los feedbacks antiguos con etiquetas rígidas se muestran como prosa corrida. No se altera el dato guardado.

## Asistente del entrenador

La asistente ya no responde desde un FAQ estático. Para cada consulta recibe, por este orden:

1. La sesión exacta del día y la modalidad, o todas las clases programadas del día si no se especifica una.
2. El feedback publicado para esa sesión.
3. Notas y adaptaciones confirmadas de la semana.
4. Una selección relevante de la biblioteca de ejercicios.
5. Identidad de modalidades e inventario del centro.

Al adaptar, conserva patrón, intención, duración, fatiga y nivel técnico. Primero ajusta carga o rango; después volumen o tiempo; luego una variante del mismo patrón; solo al final sustituye el ejercicio. Ofrece una recomendación y un plan B, indicando cómo ajustar el trabajo cuando el contexto permite calcularlo.

La caché incluye versión de prompt y huella de sesión, por lo que una respuesta antigua no se reutiliza para una sesión distinta. La asistente usa un modelo de razonamiento de programación, separado del modelo ligero empleado para regenerar un feedback aislado.

## Compatibilidad conservada

Los lectores de semanas antiguas todavía reconocen encabezados como `BIENVENIDA`, `CALENTAMIENTO` o `CIERRE`. Esto permite abrir históricos sin romper la app, pero los prompts y validadores no permiten generarlos en una sesión nueva.

No se han eliminado migraciones de base de datos ni utilidades administrativas que siguen teniendo una ruta real de uso. El prototipo `/?v2` se conserva, pero ya no forma parte de la carga inicial de las superficies principales.

## Código retirado

- FAQ estático y emparejador de respuestas de soporte.
- Prompt antiguo de la asistente del entrenador.
- Esquema y tarjeta `FeedbackV2` sin uso.
- Vista semanal de coach anterior y sus temporizadores, impresión y modo pantalla, sustituidos por la vista actual.
- Inferencia automática de reglas a partir de históricos.
- API y banderas para reactivar `method_rules` legacy.
- Scripts puntuales que modificaban una semana concreta en producción.
- Contexto público antiguo con reglas contradictorias.
- Copia SQL de la biblioteca que duplicaba el semillado JavaScript y podía quedarse desactualizada.
- Utilidades sin ninguna ruta desde la app o las APIs.

## Hallazgos documentales

Drive contiene versiones duplicadas del manual, cadenas extensas de plantillas y varias copias de una misma semana. Las carpetas destinadas a revisiones y semanas definitivas están vacías. También siguen existiendo documentos que describen EvoFit como fuerza básica o accesible.

Por ese motivo, Drive no se considera fuente normativa. Para aprovecharlo sin contaminar el método hace falta una futura organización documental con tres estados explícitos: vigente, referencia y archivo.

## Verificación mínima

- Contrato compartido presente una sola vez en cada prompt.
- Conceptos antiguos incompatibles ausentes de los prompts activos.
- Cálculo temporal, formato, oferta, inventario, feedback y EvoFit cubiertos por validadores.
- Contexto de asistente cubierto para modalidad concreta, día ambiguo, biblioteca y cambio de sesión.
- Sin archivos fuente huérfanos desde los puntos de entrada de la app y las APIs.
- Build de producción y `git diff --check` obligatorios antes de publicar la rama.
