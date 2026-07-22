# MÉTODO EVO 1.2

**Fuente única de verdad para Programming EVO**

Versión: 1.2

Fecha: 22 de julio de 2026

Estado: aprobado y activo en Programming EVO.

## 1. Qué resuelve este documento

Este método define cómo se diseña, adapta, revisa y publica la programación de Evolution Boutique Fitness. No es una colección de WODs ni una plantilla fija. Es un sistema para producir semanas coherentes dentro de un mesociclo, con identidad EVO, variedad real y una logística que funcione en sala.

El documento sustituye como referencia operativa a las reglas dispersas en prompts, plantillas antiguas, ejemplos, históricos y bancos de ejercicios. Los históricos siguen siendo útiles para aprender el estilo y evitar repeticiones, pero no crean reglas automáticamente.

## 2. Jerarquía de autoridad

Cuando dos fuentes se contradigan, se aplica este orden:

1. Decisión expresa y reciente de Marian.
2. Método EVO vigente y aprobado.
3. Oferta, horario, inventario y simultaneidad actuales.
4. Correcciones confirmadas sobre semanas reales.
5. Semanas recientes aprobadas o realmente impartidas.
6. Documentos metodológicos recientes.
7. Plantillas e históricos antiguos.
8. Ejemplos, bancos externos y propuestas generadas por IA.

Una regla automática aprendida nunca puede modificar por sí sola un no negociable. Primero debe presentarse como propuesta y ser confirmada por Marian.

## 3. Tipos de regla

Toda regla debe guardarse con uno de estos niveles:

| Nivel | Significado | Comportamiento de la app |
|---|---|---|
| No negociable | Define identidad, seguridad, oferta o un formato obligatorio | Error si se incumple |
| Regla operativa | Evita fallos habituales de tiempo, fatiga, material o ejecución | Error o aviso fuerte |
| Preferencia habitual | Es lo que normalmente funciona mejor, pero admite excepciones con intención | Aviso justificable |
| Posibilidad válida | Amplía opciones sin obligar a usarlas | Inspiración |
| Ejemplo | Ilustra una regla; no debe imitarse como plantilla | Nunca se convierte en regla |

## 4. ADN EVO

### No negociables

1. Se programa la semana completa dentro del mesociclo, no una suma de días aislados.
2. Cada sesión tiene una intención clara y una relación lógica con lo anterior y lo posterior.
3. Coherencia antes que dureza. No se programa para impresionar ni para llenar tiempo.
4. EvoFuncional se diseña primero como referencia principal. Basics, Fit y especialidades se construyen después con su propia identidad y se auditan juntas antes de publicar.
5. Parte de fuerza, técnica o skill y bloque metabólico se complementan; no acumulan sin motivo el mismo patrón, agarre, zona lumbar, hombro o impacto.
6. Las sesiones deben ser variadas en formato, duración, densidad, material, experiencia e intención.
7. La programación debe poder impartirse de verdad a grupos de hasta 10 personas.
8. La oferta real, las clases simultáneas y el inventario vigente mandan sobre cualquier plantilla.
9. La IA propone y revisa; Marian conserva la decisión final.

### Preferencias habituales

- Incluir al menos una experiencia memorable por semana sin crear caos logístico.
- Contrastar días consecutivos: pesado/ligero, técnico/metabólico, individual/partner, corto/largo o control/intensidad.
- Mantener una familia de intención compatible entre las clases del mismo día, sin convertirlas en tres copias.
- Usar ejercicios conocidos con combinaciones nuevas antes que ejercicios raros sin propósito.

## 5. Contexto operativo actual

Este apartado es configuración con fecha, no una regla eterna. La app debe permitir actualizarlo sin reescribir el método.

### Oferta julio-agosto de 2026

- EvoFuncional: lunes, martes, miércoles, jueves y viernes.
- EvoBasics: lunes, miércoles y viernes.
- EvoFit: lunes, martes, miércoles, jueves y viernes.
- EvoGimnástica: martes.
- EvoHybrix: lunes y miércoles.
- EvoFuerza y EvoTodos: sin sesión en esta semana salvo indicación expresa.
- Antes de generar, Marian puede activar o desactivar cada modalidad por día. Esa selección semanal sustituye esta configuración temporal, queda guardada con la semana y es la que usan la generación y la validación.
- Una celda sin clase se deja sin programar. No se inventa una sesión ni se genera feedback.

### Inventario conocido

- 1 RowErg, 2 bicicletas y 2 SkiErg en una sala; se desplazan las personas, no las máquinas.
- 2 trineos compartidos.
- 8 landmine movibles, normalmente por parejas; pueden repartirse entre dos clases con unos cuatro puestos por sala.
- 4 racks fijos en cada sala. En Sala II se montan como máximo 4-5 barras en halterofilia técnica.
- 12 anillas fijas en sus salas y 12 cajones movibles.
- Barras documentadas: 3 de 10 kg, 7 de 15 kg, 4 de 20 kg y 2 técnicas; el inventario estructurado contiene también los discos y material por peso.
- Capacidad de referencia: 10 personas por clase.

La fuente ejecutable completa es `src/domain/method/methodEvoV1.json`; el generador y la guía del coach consumen ese mismo inventario. La app no asume que disponer de material significa poder usarlo simultáneamente en ambas salas.

## 6. Orden real de programación

### Paso 1. Construir el briefing de la semana

Antes de redactar sesiones se recopila:

- Mesociclo y semana.
- Objetivo fisiológico y técnico.
- Porcentajes, RIR o intención de carga.
- Oferta real de cada modalidad.
- Inventario y clases simultáneas.
- Últimas 4-6 semanas disponibles, dando más peso a las recientes y aprobadas.
- Correcciones y feedback de entrenadores.
- Alumnos que suelen asistir siempre en los mismos días y rutas de cambio entre modalidades.

### Paso 2. Crear una matriz de estímulos

Para cada día y modalidad se anota internamente:

- Patrón principal y secundario.
- Zona de fatiga: hombro, lumbar, agarre, rodilla, impacto o carrera.
- Intención: fuerza, técnica, potencia, resistencia, control, estrategia o diversión.
- Formato y densidad.
- Experiencia: individual, parejas, equipos, relevos o estaciones.
- Material crítico.
- Tiempo efectivo estimado.

### Paso 3. Diseñar EvoFuncional

Se diseña la semana completa de EvoFuncional y se comprueba progresión, contraste entre días y coherencia con el mesociclo.

### Paso 4. Construir las otras modalidades

Basics y Fit no se obtienen cambiando automáticamente ejercicios o bajando peso. Se reconstruye cada sesión según su identidad. Las especialidades se añaden sin duplicar la fatiga principal.

### Paso 5. Auditar la semana completa

Se revisa en horizontal y en vertical:

- Días consecutivos.
- Cada lunes frente a lunes recientes, cada martes frente a martes recientes, etc.
- Combinaciones habituales de asistencia: lunes-miércoles, martes-jueves, lunes-viernes y otras reales.
- Rutas mixtas: Funcional→Fit, Fit→Basics, Basics→Funcional y especialidad→clase general.

### Paso 6. Validar, escribir feedback y publicar

La app ejecuta validaciones deterministas y semánticas. Solo después genera el feedback y la salida Excel/WodBuster.

## 7. Identidad de las modalidades

### 7.1 EvoFuncional

**Finalidad:** ser la programación principal y desarrollar fuerza, capacidad, técnica y habilidades de nivel intermedio-avanzado.

**Puede incluir:**

- Barra y porcentajes.
- Halterofilia y complejos con propósito.
- Gimnásticos, drills, progresiones y skills avanzados.
- Fuerza principal y accesorios.
- Potencia, estrategia y WODs exigentes.
- Opciones de acceso y de capacidad dentro de un skill.

**Reglas:**

- Un skill complejo debe tener un foco principal claro.
- Si la Parte A requiere mucha explicación o coordinación, el WOD se simplifica.
- Una opción avanzada debe entrenar a quien ya domina el movimiento; no se le deja únicamente practicando la regresión.
- Una sesión puede ser de fuerza sin WOD, de una parte larga, de skill + aplicación o de fuerza + intensidad si así lo exige la intención.

### 7.2 EvoBasics

**Finalidad:** enseñar las bases que permiten progresar hacia Funcional. No es una clase light ni una clase únicamente metabólica.

**Puede incluir:**

- Barra en squat, deadlift, press, row y posiciones básicas.
- Aprendizaje de hang power clean, push press, comba, hangs, soporte en anillas, wall walk y otras habilidades gestionables.
- Fuerza estructurada con carga moderada y margen técnico.
- Trabajo a la voz del entrenador cuando el aprendizaje lo requiera.
- WOD, parejas, relevos, máquinas o estaciones sencillas.

**Reglas:**

- Se reduce complejidad y volumen cuando sea necesario, no la intención del día.
- No se mezclan varias habilidades difíciles en la misma sesión.
- No se sustituye automáticamente la barra por goblet squat o mancuernas.
- La adaptación conserva primero patrón, estímulo, duración e intención.
- Cada clase real incluye un skill principal identificable de 8-10 minutos. Solo el principal avanza la rotación; refuerzos y aplicaciones no avanzan.
- La rotación utiliza dos colas independientes y no se reinicia cada lunes. Cada bloque de cinco clases realmente impartidas cierra exactamente con 2 skills complejos y 3 sencillos.
- La app puede recolocar el orden por fatiga, histórico, inventario, simultaneidad, espacio o variedad y prioriza familias menos enseñadas recientemente.
- La checklist decide qué se enseña, pero no limita el WOD: también se usan fuerza, core, burpees, carries, carrera, máquinas, lunges, kettlebell, dumbbell, pelotas, landmine y accesorios.
- Un WOD puede contener una familia compleja con carga y volumen controlados; el resto de movimientos debe ser sencillo y reconocible.
- La clasificación completa de 48 complejos, 38 sencillos, skills operativos y familia landmine está en `METODO_EVOBASICS.md` y en el contrato estructurado.
- En Sala II se planifican 4-5 barras como máximo cuando el bloque técnico lo requiera.
- Las instrucciones pedagógicas largas van en el feedback, no en la celda del entrenamiento.

### 7.3 EvoFit

**Finalidad:** clase completa de fuerza, accesorios y acondicionamiento con menor complejidad técnica, no menor nivel de exigencia.

**No es:**

- Una modalidad básica.
- Una versión fácil de EvoFuncional.
- Una clase de movilidad, core y mancuernas ligeras.
- Una secuencia fija de press-row-carry-core.

**Contenido del conjunto semanal:**

1. Fuerza real.
2. Trabajo accesorio.
3. WOD o bloque de acondicionamiento.

Los tres contenidos deben aparecer a lo largo de la semana, pero no tienen que repetirse como A/B/C todos los días. Una sesión puede tener fuerza + accesorios + acondicionamiento, dos bloques largos de fuerza, fuerza + acondicionamiento largo o una parte continua de fuerza-resistencia cuando la intención lo justifique.

**Fuerza en EvoFit:**

- Puede usar barra, porcentajes, RPE y RIR.
- Puede programar back squat, front squat, peso muerto, hip thrust, press, remo, landmine y otros básicos.
- Puede haber días pesados, ligeros, de volumen, tempo, unilateral o potencia sencilla.
- No se baja automáticamente un básico con barra a mancuernas.
- El WOD no repite con alto volumen el mismo patrón principal de fuerza.

**Límite técnico:**

- No hay bloques de aprendizaje de halterofilia ni progresiones gimnásticas.
- No se programa un skill con drills, niveles y práctica técnica prolongada.
- Esto no limita a quien tiene más capacidad. Se ofrece directamente una opción que ya domina, por ejemplo:
  - dominada estricta / ring row;
  - pino controlado / wall climb o variante prevista;
  - push-up completo / opción adaptada.
- La opción superior no transforma el bloque en una clase de skill.

**Experiencia:**

- Puede ser individual, por parejas, por intervalos, AMRAP, por tiempo, estaciones o relevos.
- Debe sentirse variada, fluida y con intención. Algunos días puede terminar con fatiga clara.
- Evitar recurrir por defecto a DB Floor Press, DB Row, ring row y AMRAP corto.

### 7.4 EvoHybrix

**Finalidad:** preparación híbrida reconocible y transferible a HYROX, no un circuito funcional adornado con máquinas.

**Protagonistas:**

- Carrera.
- SkiErg, RowErg y Bike como herramienta operativa.
- Sled Push y Sled Pull.
- Burpee Broad Jump.
- Farmer Carry.
- Walking Lunge o Sandbag Lunge.
- Wall Ball.

**Reglas:**

- Las sesiones deben incluir pacing, transiciones y estrategia cuando proceda.
- Se utilizan estaciones, parejas, equipos o salidas escalonadas para respetar el inventario.
- Cinco parejas pueden repartirse entre 1 Row, 2 Bike y 2 Ski; no se programa a 10 personas intentando usar un único erg a la vez.
- Los dos trineos se gestionan con carriles, relevos o bloques claros.
- En los dos días semanales se varían formato, locomoción, zonas musculares y protagonistas.
- Lunes intenso y miércoles continuo/Zona 2 es una distribución habitual útil, no una obligación eterna. El mesociclo y el histórico pueden justificar otra combinación.
- Cuando la explicación es breve, se buscan aproximadamente 40-42 minutos efectivos.
- Se escribe `estaciones` para espacios físicos y `zonas` para intensidades fisiológicas.

### 7.5 EvoGimnástica

**Finalidad:** progresar en una capacidad gimnástica principal con calidad.

**Reglas:**

- Una capacidad principal por sesión: tracción, empuje/inversión, compresión/core, control escapular o pierna/control.
- Preparación, progresión, práctica de calidad y complemento coherente.
- Una regresión clara y una progresión clara.
- Puede utilizar parejas y dinámicas divertidas sin convertir la sesión en un circuito aleatorio.
- Con la oferta actual se programa el martes y se audita su cruce con las clases generales del miércoles.

### 7.6 EvoFuerza

**Finalidad:** reforzar la fuerza estructural sin copiar el estímulo pesado de Funcional.

**Reglas:**

- Pocos movimientos y objetivo claro.
- Series, porcentajes, RIR y descansos definidos.
- Accesorios complementarios.
- No duplicar exactamente el básico pesado del mismo día si ambos públicos pueden cruzarse.

### 7.7 EvoTodos y otras ofertas

Solo se programan cuando la oferta activa lo indique. Suelen priorizar comunidad, parejas, equipos, relevos o una experiencia especial, pero no se convierten en una obligación semanal si no hay clase.

## 8. Mesociclos

### 8.1 Fuerza — 6 semanas

| Semana | Intención principal | Referencia orientativa |
|---|---|---|
| S1 | Test o actualización de referencias operativas | Single técnico o 2-3RM cuando sea más seguro |
| S2 | Construcción de volumen y control | 65-75 %, RIR 2-3 |
| S3 | Producción de fuerza e intensificación inicial | 75-80 %, hasta 85 % según movimiento |
| S4 | Intensificación | 80-85 %, pocas reps, RIR 1-2, sin fallo |
| S5 | Pico controlado | 90-95 %, volumen muy bajo, sin fallo |
| S6 | Retest o verificación | 95-100 % cuando proceda; alternativa 2-3RM o test submáximo |

Reglas:

- La técnica manda sobre el porcentaje.
- Utilizar porcentajes operativos y fáciles de montar.
- Al subir intensidad, baja el número de repeticiones y aumenta el descanso dentro de un límite útil para la clase.
- No se dejan 3-4 minutos vacíos entre series de un único movimiento. Si la cadencia alcanza 3 minutos, se combina el básico con un segundo movimiento o accesorio que no perjudique la serie principal. La única excepción son las últimas series de la S6 para buscar o verificar un RM, con hasta 3 minutos de descanso real.
- En la mayoría de días viables de Funcional se incluye un básico elegido estratégicamente: squat, deadlift, press, floor press, row o pull-up. No se reparten por cuota, sino según fatiga, progresión y rutas de asistencia.
- Casi todas las semanas incluyen una exposición de halterofilia. Se programa en fuerza o técnica, progresa entre semanas y permite tocar cargas medias-altas con repeticiones limpias; no se esconde dentro de un WOD complejo.
- El WOD posterior se acorta o simplifica si la fuerza requiere subidas, spot, explicación o mucha concentración.
- Un RM solo se registra en una prueba real. En semanas normales se registra peso o porcentaje únicamente si sirve para la progresión.

### 8.2 Autocarga — 5 semanas

| Semana | Intención principal |
|---|---|
| S1 | Base: posiciones, isométricos, tempos, control escapular y variantes de acceso |
| S2 | Volumen mixto: más trabajo acumulado, skill + fuerza de apoyo |
| S3 | Densidad: variantes más exigentes, lastre moderado y menor pausa |
| S4 | Pico técnico: alta calidad, variante difícil o lastre con volumen menor |
| S5 | Test: máximo técnico, repeticiones limpias o comprobación de habilidad sin fallo feo |

La progresión se construye con rango, variante, tempo, estabilidad, volumen, lastre y calidad. Los porcentajes solo aplican a los bloques cargados de apoyo; no definen por sí solos la progresión gimnástica.

### 8.3 Mixto — 4 semanas

| Semana | Intención principal |
|---|---|
| S1 | Integración y volumen equilibrado; cargas medias-altas alrededor de 70-80 % cuando proceda |
| S2 | Continuidad y variedad; cargas medias-bajas alrededor de 60-65 % |
| S3 | Volumen + potencia; cargas moderadas, fluidez y fuerza-resistencia |
| S4 | Densidad, resistencia, velocidad, estrategia y cierre del ciclo |

La carga es una herramienta, no el fin. Se combinan fuerza, autocarga, potencia y metabolismo sin convertir cada día en un entrenamiento largo.

## 9. Construcción de la sesión

### 9.1 Salida visible

La programación publicada empieza directamente en:

- `A)` / `B)` / `C)`, o
- `PARTE ÚNICA` cuando corresponda.

No se muestran bloques llamados:

- Bienvenida.
- Movilidad.
- Calentamiento.
- Activación general.
- Preparación.
- WOD prep.
- Transición.
- Cierre.

La IA sí calcula internamente esos tiempos para comprobar que la clase cabe en 60 minutos.

### 9.2 Tiempo efectivo

- Varias partes con fuerza, técnica o explicación: normalmente 30-32 minutos efectivos.
- En Basics, un skill sencillo de 8-10 minutos puede combinarse con 25-30 minutos de fuerza o aplicación y llegar a 38-40 minutos efectivos cuando la explicación y el montaje caben en los 20 minutos restantes de clase.
- Intervalos con el último descanso omitido: puede aparecer una suma de 33 minutos si el reloj real lo justifica.
- Sesión técnica de especialidad: alrededor de 30 minutos efectivos.
- Parte única sencilla o EvoHybrix con poco briefing: aproximadamente 40-42 minutos.
- Un WOD no se alarga para llenar tiempo. Un sprint puede durar 4-7 minutos y seguir siendo correcto.

Los minutos se muestran en el título de cada bloque. No se añade una línea independiente llamada `TIEMPO EFECTIVO` ni un cronograma `0'-60'`.

### 9.3 Títulos y formatos

- Los títulos de bloques y formatos se escriben en español.
- Los nombres oficiales de ejercicios pueden mantenerse en la nomenclatura habitual del equipo.
- Ejemplos de título:
  - `A) FUERZA — 15 MIN`
  - `B) INTERVALOS — 18 MIN`
  - `B) AMRAP — 12 MIN`
  - `B) POR TIEMPO — TC 12 MIN`
  - `C) TRABAJO EN PAREJAS — 10 MIN`
- `TC` se utiliza solo en un trabajo por tiempo con límite.
- Un AMRAP se titula AMRAP y no se disfraza como `POR TIEMPO`.
- No se duplica el formato en título y primera línea.

### 9.4 Cálculo temporal

El reloj se calcula de forma determinista. Ejemplo:

- 5 rondas de 2 minutos de trabajo y 2 minutos de descanso, sin descanso final, duran 18 minutos.

La app debe detectar cuando el número de minutos, rondas o descansos descritos no coincide con el título.

### 9.5 Fuerza

- Indicar series, repeticiones, carga o RIR y descanso.
- Priorizar repeticiones sólidas y sin fallo salvo prueba deliberada.
- Una cadencia inferior a 3 minutos puede reservarse a un único básico. Desde 3 minutos se añade un segundo movimiento o accesorio coherente; no se programa descanso largo vacío.
- El accesorio solo se utiliza si complementa sin perjudicar la recuperación ni la técnica del básico.
- No programar alto volumen del mismo patrón en el WOD posterior.

### 9.6 Variedad de formatos

- En Funcional, los intervalos no pueden convertirse en el formato dominante de cuatro días de la semana.
- Si aparecen tres días de intervalos, la app lo señala para revisión; con cuatro días, bloquea la publicación hasta rediseñar.
- Dos sesiones de intervalos no repiten por inercia la misma duración ni la misma relación trabajo-descanso.
- La semana rota entre AMRAP, por tiempo, ladder, chipper, partner, team, relevos, trabajo continuo e intervalos según el estímulo.

### 9.7 Creatividad útil

La creatividad puede venir de:

- Ventanas de trabajo.
- Cambios de ritmo.
- Relevos cortos.
- Objetivos compartidos.
- Descanso ganado.
- Acumulación por equipos.
- Estrategia de reparto.
- Bloques que se desbloquean.
- Sincronizados puntuales.
- Consistencia entre rondas.

No se utiliza una dinámica si complica explicación, seguridad, material o corrección.

## 10. Variedad e histórico

Antes de aprobar una semana se comparan al menos las últimas 4-6 semanas disponibles.

Cada sesión se compara en siete ejes:

1. Patrón principal.
2. Ejercicio exacto.
3. Implemento.
4. Formato y densidad.
5. Experiencia: individual, partner, team, relay o estrategia.
6. Posición semanal: lunes frente a lunes, martes frente a martes, etc.
7. Compatibilidad con otras modalidades y rutas reales de asistencia.

Si coinciden tres o más ejes con una sesión reciente, se rediseña o se justifica la progresión.

### Fatiga que debe auditarse

- Empuje de tren superior.
- Tracción y agarre.
- Dominante de rodilla.
- Bisagra y zona lumbar.
- Carga axial.
- Hombro por press, halterofilia e inversión.
- Saltos, carrera e impacto.
- Unilateralidad acumulada.

No se repite el patrón principal en días consecutivos ni en el mismo día fijo de semanas seguidas salvo progresión deliberada. Si se mantiene un básico, se cambia su papel, densidad, accesorio o experiencia.

## 11. Armonía entre modalidades

Funcional, Basics y Fit deben ser compatibles para quien mezcla clases, pero no están obligadas a copiar exactamente el mismo ejercicio ni el mismo patrón principal.

La prioridad es:

1. Evitar solapamientos de fatiga en la ruta real del alumno.
2. Mantener la intención del mesociclo.
3. Conservar la identidad de cada modalidad.
4. Compartir una familia de estímulo cuando ayude.

Si mantener el mismo patrón en las tres modalidades empeora fatiga, material o identidad, se permite una divergencia planificada.

## 12. Material y logística

### No negociables

- No superar el inventario disponible.
- No depender del mismo material limitado en dos clases simultáneas sin un plan.
- No crear colas ni tiempos muertos largos.
- No utilizar máquinas solo para adornar el entrenamiento.
- Limitar normalmente a 1-2 las transiciones importantes de material.
- En parejas debe quedar claro si se alterna por ejercicio, ronda, tiempo o tarea.

### Clases de 10

- Cinco parejas suelen funcionar mejor que dos equipos grandes cuando se busca ritmo continuo.
- En estaciones, una pareja puede empezar en cada puesto y rotar en un único sentido.
- Si hay menos asistencia, se dejan estaciones libres sin cambiar la lógica.
- La distribución exacta con clase llena se explica en el feedback, no se fija como texto obligatorio en el entrenamiento.

### Sala II

- Halterofilia o barra técnica: 4-5 barras máximo, parejas por nivel y cargas compatibles.
- En un E3MOM de fuerza por parejas puede trabajar uno mientras el otro hace una tarea complementaria breve y después cambiar, conservando descanso real.
- Para una estructura sencilla: minuto 1 roles A/B, minuto 2 cambio, minuto 3 descanso de ambos.
- Si Basics coincide con Fit, las máquinas solo se asignan después de comprobar la reserva real de Fit/Hybrix.

## 13. Feedback al entrenador

El feedback es una nota breve de Marian al entrenador.

### Formato

- Tono natural, cercano y oral.
- Preferentemente un único párrafo fluido de 3-5 frases, normalmente entre 35 y 90 palabras.
- No se imponen viñetas ni se repite todo el entrenamiento.
- Se empieza explicando qué buscamos en la sesión y cómo queremos que se sienta. Después se añade únicamente la decisión práctica que puede cambiar la forma de darla.
- Se utilizan frases completas y conectadas, evitando cadenas de órdenes, frases cortadas, eslóganes y encabezados rígidos como `OBJETIVO / SENSACIONES / ANTICIPACIÓN`.

### Contenido obligatorio

- Intención del día.
- Sensación que buscamos durante la sesión.

### Contenido útil cuando aporta

- Elección de pesos cuando pueda generar dudas.
- Organización de parejas, estaciones, sala o material si afecta al flow.
- Cuello de botella o error que probablemente aparezca.
- Adaptación principal.

### Reglas

- Antes de devolver el feedback se comprueba que todos los ejercicios, materiales, formatos, parejas y detalles organizativos mencionados existen en la sesión.
- No se inventa una carrera, una pareja o una estación para completar el texto.
- Los detalles largos de logística van aquí y no dentro del entrenamiento.
- No se pide apuntar resultados generales, marcas de grupo ni scores en la pizarra.
- Solo se registra un dato individual si tiene utilidad de progresión: RM en día de prueba, peso de trabajo, porcentaje o última serie cuando sirva para la semana siguiente.
- Una clase no programada no recibe feedback.

## 14. Contrato de salida para Excel, Chat y edición diaria

Los tres flujos comparten el mismo contrato:

1. Misma oferta y mismas celdas programadas.
2. Mismo formato visible A/B/C o Parte Única.
3. Duración incluida en el título del bloque.
4. Sin calentamientos ni cronograma completo visibles.
5. Entrenamiento y feedback en campos separados.
6. Clases no programadas con el valor técnico que la app necesite, pero sin inventar sesión ni feedback.
7. Nomenclatura de modalidades y ejercicios consistente.
8. Sin notas auxiliares debajo del último bloque en la hoja publicada.

## 15. Validaciones obligatorias

### 15.1 Deterministas — error

- Clase programada en un día no ofertado.
- Feedback generado para una clase no programada.
- Bloques visibles de bienvenida, movilidad, calentamiento, preparación, transición o cierre.
- Línea independiente `TIEMPO EFECTIVO` o cronograma `0'-60'`.
- AMRAP rotulado como `POR TIEMPO` o con TC.
- Trabajo por tiempo sin TC cuando necesita límite.
- Duración de intervalos que no coincide con rondas, trabajo y descansos.
- Letras de bloque duplicadas o desordenadas.
- Uso simultáneo imposible de material limitado.
- Feedback que menciona ejercicios, material, parejas o formatos ausentes.
- Registro de RM fuera de un test real.
- Cadencia de fuerza de 3 minutos o más con un único movimiento fuera de las últimas series de RM de S6.
- Cuatro días de intervalos en EvoFuncional.

### 15.2 Semánticas — error o aviso fuerte

- EvoFit descrito como básico, light o fuerza accesible.
- EvoFit sin una estructura deliberada o sin que la semana complete fuerza, accesorios y acondicionamiento.
- EvoFit con bloque de aprendizaje de halterofilia o gimnásticos.
- Basics convertido en una copia ligera sin aprendizaje ni fuerza.
- Basics que rompe la cola de skills, repite una habilidad reciente sin progresión o deja de preparar la entrada a Funcional.
- WOD que repite con volumen alto el patrón principal de fuerza.
- Fatiga consecutiva de hombro, lumbar, agarre, rodilla o impacto.
- Tres o más ejes de similitud con una sesión reciente sin progresión justificada.
- Hybrix que parece un circuito genérico y no entrenamiento híbrido.
- Explicación o logística demasiado compleja para el tiempo real.

### 15.3 Avisos justificables

- Más de dos transiciones de material.
- Repetición del mismo formato o experiencia en días cercanos.
- Tres días de intervalos en EvoFuncional o repetición de la misma relación trabajo-descanso.
- Ausencia de un momento memorable en la semana.
- Diferencia deliberada respecto a la familia de estímulo diaria.
- Tiempo efectivo fuera de la zona habitual pero matemáticamente coherente.

## 16. Memoria y aprendizaje

El sistema debe separar:

- Método base aprobado.
- Configuración actual: oferta, inventario y horarios.
- Preferencias manuales confirmadas por Marian.
- Observaciones recientes de entrenadores.
- Propuestas automáticas pendientes de aprobación.
- Históricos y ejemplos.

Una observación se convierte en regla solo cuando:

1. se repite en varias sesiones o revela un riesgo claro;
2. se formula con alcance y nivel de autoridad;
3. no contradice un no negociable;
4. Marian la confirma.

Hasta aprobar esta versión, el aprendizaje automático debe permanecer desconectado de la escritura del método.

## 17. Ejemplos: uso correcto

Los ejemplos sirven para demostrar una regla y probar validadores. Nunca deben ser plantillas que se repitan semana tras semana.

### Ejemplo de fuerza + intensidad

```text
A) FUERZA — 15 MIN

Back Squat
5 series x 4 repeticiones @75-80 %
Descanso: 2:00-2:30

B) INTERVALOS — 18 MIN

5 rondas:
2 min de trabajo / 2 min de descanso
Durante los 2 min, máximas rondas de:
5 Burpees
10 Wall Balls

La sesión termina al finalizar el quinto intervalo de trabajo; no se realiza el último descanso.
```

### Feedback coherente

```text
En la fuerza quiero series sólidas y sin fallo; si el 80 % empieza a ralentizarse demasiado, que mantengan el peso anterior. Los intervalos son cortos, así que aquí sí quiero intensidad desde el principio, pero sin romper el wall ball en demasiadas tandas. Solo apuntad el peso de la última serie si nos sirve para la siguiente semana.
```

Este ejemplo no obliga a utilizar squat, burpees, wall ball ni esta estructura. Solo ilustra tiempo real, fuerza sin fallo y feedback conectado con la sesión.

## 18. Criterio final

Una buena semana EVO cumple simultáneamente cuatro condiciones:

1. Hace progresar al alumno dentro del mesociclo.
2. Se puede impartir con claridad y buen ritmo.
3. Respeta la identidad de cada modalidad.
4. Ofrece variedad y una experiencia reconocible de Evolution.

Si el scoring automático y el criterio real de sala entran en conflicto, prevalece el criterio real de sala y la herramienta debe explicar el motivo, no forzar una puntuación.
