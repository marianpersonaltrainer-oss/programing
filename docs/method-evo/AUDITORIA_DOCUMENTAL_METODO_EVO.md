# Auditoría documental previa al Método EVO 1.2

Fecha: 21 de julio de 2026

## 1. Alcance revisado

Se inventariaron los 97 elementos contenidos en la carpeta `PROGRAMMING EVO`:

| Área | Elementos |
|---|---:|
| 01 MÉTODO EVO | 7 |
| 02 INVENTARIO Y MATERIAL | 6 |
| 03 PLANTILLAS | 22 |
| 04 HISTÓRICO FUERZA | 13 |
| 05 HISTÓRICO AUTOCARGA | 21 |
| 06 HISTÓRICO MIXTO | 19 |
| 07 TEMPORADA ACTUAL | 9 |
| 08 REVISIONES Y CORRECCIONES | 0 |
| 09 SEMANAS DEFINITIVAS | 0 |

También se analizaron:

- Los 10 Excel aportados en este trabajo: semanas de fuerza, autocarga y mixto.
- Las semanas 2026 más recientes de los tres históricos y la temporada actual.
- Las correcciones confirmadas en nuestras conversaciones, especialmente la revisión de S4 de fuerza y la redefinición de EvoFit.
- La habilidad reutilizable actual de creación de semanas EVO y sus referencias.
- El estado metodológico descrito durante la consolidación V1 del PR #4.

Los 22 archivos de plantillas forman cadenas de versiones. Se utilizó la versión más reciente de cada familia para conocer la lógica que Cursor pudo haber heredado; no se trató cada copia antigua como una fuente independiente de autoridad.

## 2. Fuentes con mayor peso

- `MÉTODO EVO · Manual Definitivo 2026` (documento interno)
- `Proceso Programación Evo` (documento interno)
- `Perfil IA EVO` (documento interno)
- `Protocolo — Mesociclo de autocarga` (documento interno)
- Las semanas recientes de `07 TEMPORADA ACTUAL`.
- Las correcciones posteriores confirmadas por Marian.

El título “Manual Definitivo” no lo convierte por sí solo en la fuente final: contiene reglas que Marian ha corregido después. Además, las carpetas destinadas a revisiones y semanas definitivas están vacías. Por eso se ha usado una jerarquía explícita de autoridad.

## 3. Hallazgo principal

Cursor no estaba fallando por una única instrucción. Estaba resolviendo contradicciones entre varias fuentes sin saber cuál era método, cuál era configuración temporal y cuál era solo un ejemplo.

Las capas mezcladas eran:

1. Principios estables del método.
2. Oferta e inventario de un momento concreto.
3. Plantillas con estructuras rígidas.
4. Semanas históricas con errores y correcciones parciales.
5. Ejemplos canónicos que la IA tiende a imitar.
6. Reglas manuales y automáticas guardadas por la app.
7. Prompts distintos para Chat, Excel y edición diaria.

La solución no es añadir otra frase de “máxima prioridad”, sino crear una única estructura de método y eliminar las reglas incompatibles de los demás flujos.

## 4. Contradicciones resueltas

| Tema | Fuentes antiguas o contradictorias | Decisión consolidada |
|---|---|---|
| EvoFit | “Fuerza básica”, movilidad/core inicial, ejercicios sencillos y fuerza accesible | Fuerza real + accesorios + WOD; menor complejidad técnica, no menor exigencia |
| Barra en EvoFit | Algunos bancos reservan porcentajes y básicos para Funcional | Fit puede usar barra, porcentajes, RPE/RIR y días pesados |
| Capacidad en Fit | Pull-up y pino aparecen como exclusivos de Funcional | Puede ofrecerse directamente la opción que la persona ya domina, sin crear un skill |
| Skill en Fit | Ejemplos con técnica y progresiones | No hay bloques de aprendizaje de halterofilia ni gimnásticos |
| Basics semanal | Plantillas exigen 2 skills + 2 fuerzas en cinco días | Con la oferta de tres días se protege al menos una exposición de barra/fuerza, una habilidad y una aplicación/conditioning |
| Barra en Basics | Documentos antiguos priorizan DB/KB y evitan barra | La barra forma parte del aprendizaje cuando la gestión es viable |
| Calentamiento visible | Plantillas obligan A calentamiento, B específico, C fuerza y D WOD | El Excel publicado empieza en A/B/C o Parte Única; el calentamiento se calcula internamente |
| Duración | 28-30', 25-30', 35-40', cronogramas 0'-60' | 30-32' habitual con varias partes; 40-42' en una parte sencilla/Hybrix; sin línea de tiempo efectiva |
| Feedback | Viñetas obligatorias, bloques fijos, “cero logística” o párrafos muy largos | Párrafo breve y natural; logística selectiva cuando afecta al funcionamiento |
| Registros | Marcas y scores generales en pizarra | Solo registros individuales útiles; RM únicamente en test real |
| Armonía diaria | “Mismo patrón todas las clases” como regla absoluta | Familia compatible cuando ayuda; puede divergir para proteger identidad, material o fatiga |
| Rotación Fit | Herramienta fija por semana como no negociable | Rotación de implementos como preferencia de variedad, no calendario rígido |
| Basics | “El skill de C aparece siempre en D” | Puede consolidarse en el WOD si tiene sentido; no es obligatorio |
| Recorte temporal | “Recorta D, nunca C” | Se rediseña la sesión completa según su intención; no hay bloque intocable por sistema |
| Hybrix | Lunes intensidad y miércoles Zona 2 como obligación | Distribución habitual útil, pero modificable por mesociclo e histórico |
| Material | Limitación general de barras o “no hay restricción” | Inventario dinámico; barras suficientes, pero 4-5 máximo en Sala II para halterofilia técnica |
| Clase no ofertada | Históricos generan feedback aunque la sesión esté vacía | Sin sesión no hay programación ni feedback |

## 5. Evolución observada en los Excel

### Primeras versiones

Las semanas antiguas o no corregidas tienden a incluir:

- `BIENVENIDA`, `CALENTAMIENTO` y `CIERRE` dentro de la celda.
- Cronogramas completos de 60 minutos.
- Feedback demasiado largo o genérico.
- Respuestas de IA para clases no programadas.
- Repetición de bisagra, ring row, DB Floor Press y AMRAPs cortos en Fit.
- Misma familia muscular repetida varios días.
- Material imposible o no organizado.

Ejemplos detectados:

- Una versión de S4 de fuerza contiene 30 menciones visibles de `BIENVENIDA`, 10 de `CALENTAMIENTO` y 16 de `CIERRE`.
- Una versión de S6 de fuerza contiene más de 30 bloques visibles de bienvenida y 17 calentamientos.
- Una versión antigua de S3 de fuerza programa cronogramas `0'-60'` para todas las modalidades.

### Versiones recientes

Las semanas recientes mejoran en:

- Salida A/B/C más limpia.
- Mayor uso real de barra en Basics y Fit.
- Integración de EvoHybrix.
- Mejor variedad de formatos.
- Feedback más cercano a la voz de Marian.
- Mayor atención a RIR, porcentajes y tiempo real.

Pero todavía aparecen errores que no deben convertirse en método:

- Un EMOM descrito como 18 minutos cuya propia nota dice 16.
- Feedback que inventa ejercicios, parejas o tareas.
- Bloques con letras duplicadas.
- Fit con halterofilia técnica en el WOD.
- Sesiones de Fit excesivamente básicas en unas semanas y excesivamente complejas en otras.
- `AMRAP` tratado como `POR TIEMPO`.
- Un único RowErg planteado como si lo utilizara todo el grupo.
- Feedback generado para clases no ofertadas.
- Ejercicios y fatiga repetidos dentro de la misma sesión.

## 6. Qué sí se conserva del histórico

### Principios estables

- Pensar por semanas y mesociclos.
- Diseñar primero EvoFuncional.
- Coherencia antes que dureza.
- Contrastar formatos, duraciones e intensidades.
- Auditar hombro, lumbar, agarre, rodilla, saltos y carrera.
- No repetir automáticamente el patrón del mismo día fijo.
- Mantener un momento memorable sin caos.
- Limitar transiciones importantes de material.
- Hacer explícita la dinámica partner: ejercicio, ronda, tiempo o tarea.

### Ideas y recursos

- Landmine, strongman, trineo, carries y estaciones.
- Intervalos ON/OFF y relevos cortos.
- Barra en Basics y Fit.
- Progresiones de comba, hangs, handstand y pull-up para Basics/Funcional.
- Parejas de cinco puestos para clases de 10.
- Rutas Hyrox con carrera, máquinas y estaciones específicas.

Los bancos de ejercicios se conservan como inspiración. No deben imponer por sí solos nivel, clase o mesociclo.

## 7. Fuentes que no deben definir el método

- `Copia de SYK_Biblioteca_v7_Mono`: contiene recursos de negocio y marketing, no programación.
- `Standars competi`: referencia de una competición concreta, no norma semanal.
- Captura antigua de WodBuster: referencia visual, no fuente metodológica.
- Cadenas de plantillas v3-v18: documentan evolución, pero las reglas rígidas no se heredan automáticamente.
- Ejemplos históricos con errores: sirven como fixtures negativos para tests.

## 8. Reglas legacy que Cursor debe poner en cuarentena

- EvoFit = fuerza básica, accesible o tipo Tone.
- Juego siempre en el calentamiento de Basics.
- En Fit nadie sale destrozado.
- A/B/C/D fijos con calentamiento visible.
- Cronograma obligatorio de 58-60 minutos.
- Mismo patrón exacto en todas las modalidades.
- Herramienta de Fit fijada por semana como regla no negociable.
- Skill de Basics repetido obligatoriamente dentro del WOD.
- Dos skills + dos fuerzas semanales sin consultar la oferta.
- Feedback obligatorio en viñetas o con bloques fijos.
- Prohibición absoluta de logística.
- Marcas generales, score o pizarra como cierre habitual.
- Feedback para celdas no programadas.
- Material de la Biblioteca oficial como autorización absoluta por clase.

## 9. Huecos que el nuevo sistema debe tratar como configuración

No deben incrustarse en prompts permanentes:

- Oferta por día y mes.
- Simultaneidad de salas.
- Inventario y unidades.
- Número de alumnos esperado.
- Festivos.
- Especialidades activas.
- Mesociclo actual y duración decidida por Marian.

## 10. Decisión técnica recomendada

Separar en la app:

1. `Método EVO`: reglas versionadas.
2. `Contexto operativo`: oferta, horario e inventario.
3. `Histórico`: sesiones y feedback realmente aprobados.
4. `Preferencias manuales`: decisiones confirmadas por Marian.
5. `Aprendizajes propuestos`: pendientes de aprobación.
6. `Ejemplos`: fixtures de prueba, nunca reglas.

Esta condición ya se ha cumplido en el Método EVO 1.2: el método canónico está aprobado y conectado a los flujos de generación, edición, revisión y publicación de V1. Las decisiones manuales confirmadas se conservan como preferencias subordinadas y nunca pueden sustituir una regla no negociable.
