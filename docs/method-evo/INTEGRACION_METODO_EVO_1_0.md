# Integración del Método EVO 1.2 en Programming EVO V1

Fecha: 22 de julio de 2026

Estado: aprobado por Marian e integrado en la rama de Programming EVO. Pendiente únicamente de la publicación de la rama en el entorno activo.

## Resultado de esta rama

La aplicación deja de mantener definiciones metodológicas completas y distintas en cada prompt. Chat, Excel, edición diaria y briefing consumen la misma proyección de `src/domain/method/methodEvoV1.json` mediante `src/domain/method/methodEvoV1.js`.

La rama también:

- convierte los prompts de cada flujo en envoltorios de tarea;
- aísla la clave legacy `programingevo_method` para que no sustituya el método nuevo;
- excluye las observaciones automáticas del prompt hasta que Marian las apruebe;
- evita que un histórico o referencia de Drive se convierta automáticamente en regla;
- deriva el bloque de mesociclo de la fuente estructurada;
- mantiene el método y el mesociclo cuando una llamada tardía recorta la biblioteca por tamaño;
- bloquea antes de publicar varias infracciones deterministas del contrato visible.

## Archivos autoritativos

- `METODO_EVO_1_0.md`: explicación humana y decisiones consolidadas.
- `src/domain/method/methodEvoV1.json`: contrato estructurado versionado.
- `src/domain/method/methodEvoV1.js`: única puerta de entrada de la aplicación al contrato.

Los ejemplos, documentos históricos, referencias importadas y reglas aprendidas no tienen autoridad para modificar estos archivos.

## Validaciones activas en esta fase

- clase en un día no ofertado cuando la oferta actual lo define;
- ausencia de feedback para una clase sin sesión;
- secciones visibles prohibidas y cronograma `0'-60'`;
- cabeceras y orden de bloques;
- AMRAP mal rotulado como `POR TIEMPO` o con `TC`;
- `POR TIEMPO` sin `TC`;
- aritmética de intervalos con trabajo, descanso y último descanso omitido;
- duración obligatoria dentro del título de cada bloque;
- uso de `RM` fuera de un test real;
- incoherencias de feedback de alta confianza: parejas/relevos, carrera, estaciones, RowErg, SkiErg, trineo y registro de RM ausentes de la sesión;
- definición explícita de EvoFit como básico, light o fuerza accesible;
- EvoFit sin fuerza, accesorios y acondicionamiento identificables;
- bloques específicos de habilidad, progresión o aprendizaje técnico en EvoFit.

## Validaciones semánticas que siguen necesitando revisión humana

No se presentan como resueltas por una búsqueda de palabras. Requieren datos estructurados o revisión semántica:

- correspondencia semántica completa del resto de entidades del feedback con la sesión;
- identidad completa de Basics, Fit, Hybrix, Gimnástica y Fuerza;
- complementariedad entre fuerza, accesorios y WOD;
- fatiga semanal y rutas mixtas de asistencia;
- similitud histórica en los siete ejes definidos en el método;
- tiempo real de explicación/transición cuando no puede deducirse del texto.

Ya están conectados de forma estructurada:

- inventario único compartido por generador y guía del coach;
- avisos de máquinas, trineos, bancos, barras pesadas y landmine entre clases;
- amortización de montajes costosos;
- catálogo confirmado de 48 movimientos complejos y 38 sencillos;
- familia landmine y bancos de movimientos/complementarios;
- bloque móvil de EvoBasics con 2 complejos + 3 sencillos por cada cinco clases reales;
- metadatos de entrada, eventos impartidos y salida de la rotación en cada semana.

Hasta implementar esos validadores, el prompt obliga a revisar estos puntos y la publicación conserva la revisión humana de Marian como último control.

## Capas legacy en cuarentena

- `programingevo_method`: se conserva para poder auditarlo, pero V1 no lo lee.
- `programingevo_method_learned`: conserva las decisiones y sugerencias anteriores, pero V1 usa una clave versionada nueva y exige reconfirmarlas.
- observaciones automáticas de `methodLearnedStorage`: se guardan como propuestas y no entran en el prompt.
- `method_rules` remoto: permanece excluido por defecto mediante la bandera ya existente.
- inferencias desde referencias históricas: ya no se añaden al método de Chat ni de Excel.
- parsers de `BIENVENIDA` y `CIERRE`: se mantienen únicamente para abrir semanas antiguas; no autorizan ese formato en una publicación nueva.

## Aprobación

El contrato declara `meta.status = "active"` en la versión `1.2.0`, tras la indicación expresa de Marian de incorporar este trabajo a la app. La publicación del código sigue siendo una operación separada de cualquier migración de Supabase; esta versión no necesita una migración de base de datos.

## Comprobaciones

```bash
npm run test:prompts
npm run test:method
npm run test:evo-rules
npm run build
git diff --check
```
