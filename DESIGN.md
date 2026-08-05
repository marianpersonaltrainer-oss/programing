# DESIGN.md
## Sistema visual de Programming EVO

**Estado:** documento vivo · Fase 2.2 aprobada · Fase 2.3 activa
**Producto:** Programming EVO
**Superficie actual:** sandbox local `?incorporaciones`

Programming EVO mantiene una identidad única: navegación oscura, superficies de trabajo claras, tipografía de carácter para orientar y tipografía de lectura para decidir y actuar sin esfuerzo.

### Fundamentos EVO

- Oswald para títulos, hitos y mensajes breves de orientación.
- Montserrat para lectura, controles, ayudas y metadatos.
- Negro EVO `#0C0B0C` para navegación y cabecera.
- Morado EVO `#A729AD` para acción y selección.
- Lila `#F6E8F9`, amarillo cálido `#FFFFE2` y blanco para ordenar el área de trabajo.
- Amarillo vivo reservado para foco, progreso o aviso puntual; nunca como relleno dominante.
- Controles táctiles con un mínimo de 44 px.

## Patrón UX/UI de Operativa y Mi turno

La operativa debe responder primero a una pregunta: **¿qué toca hacer ahora?** La pantalla revela después la información y los controles secundarios que ayudan a completar esa acción.

### Jerarquía y progresión

1. **Ahora:** una única tarjeta principal contiene la siguiente acción disponible. No compite con otras llamadas primarias.
2. **Información:** los casos especiales aparecen como una lista compacta de máximo tres elementos y solo muestran contexto accionable.
3. **Registro:** incidencia, primera clase y feedback se presentan como controles secundarios, visualmente subordinados.
4. **Cierre:** solo adquiere jerarquía de acción principal cuando las tareas críticas propias están completas; antes se muestra como siguiente etapa, no como llamada dominante.

La progresión funciona por revelado: se muestra primero lo que toca hacer; las tareas completadas pasan a un resumen compacto y las acciones futuras pierden peso visual.

### Superficies y color

- Menú lateral y cabecera superior permanecen oscuros.
- El área de trabajo utiliza una base clara EVO: `#F6E8F9`, `#FFFFE2` o blanco según jerarquía.
- El morado identifica selección, foco y acción principal.
- El amarillo vivo se limita a pequeños indicadores de progreso o foco; no se usa como etiqueta recurrente.
- Las tarjetas son compactas, con bordes suaves y sombras discretas; no se apilan contenedores decorativos innecesarios.

### Densidad y controles

- Reducir etiquetas, píldoras, encabezados y textos repetidos.
- No repetir responsable o estado cuando el contexto ya los deja claros.
- Las acciones secundarias usan botones ligeros, enlaces o controles de borde; nunca compiten con la acción principal.
- Cada bloque mantiene una sola acción dominante y objetivos táctiles de al menos 44 px.
- El resumen del turno reúne franja, hora, entrenador, estado y progreso sin convertirse en otro bloque protagonista.

### Escritorio y móvil

El comportamiento es equivalente en escritorio y móvil:

- misma jerarquía Ahora → Información → Registro → Cierre;
- misma acción principal en el mismo estado;
- lista de casos especiales limitada a tres;
- navegación máxima de dos niveles;
- en móvil, controles apilados y lectura lineal sin perder contexto;
- en escritorio, el ancho adicional mejora respiración y agrupación, pero no añade acciones simultáneas.

### Formulario de primera clase

El registro obligatorio conserva el mismo lenguaje ligero de Operativa:

- tres bloques numerados en una única hoja o diálogo desplazable;
- una pregunta visible por bloque y opciones táctiles de al menos 44 px;
- campos opcionales subordinados a su pregunta, sin convertir el formulario en una ficha clínica;
- validación clara junto al bloque incompleto;
- una única acción principal `Guardar primera clase` al final;
- el resumen guardado sustituye el formulario al reabrirlo y muestra responsable y hora sin duplicar etiquetas;
- comportamiento, orden y contenido equivalentes en escritorio y móvil.

## Patrón de secuencia guiada de Mi turno

La pantalla principal representa un recorrido y no un tablero. Solo el momento actual tiene protagonismo; lo completado se resume y lo futuro se anuncia sin desplegar sus controles.

### Cinco momentos

0. `Iniciar turno`: una tarjeta clara registra la entrada y el turno asignado.
1. `Abrir y preparar la sala`: checklist vertical compacta, con una acción principal por punto, metadatos auditables al completarlo y `Registrar problema` como acción subordinada.
2. `Prepara tu turno`: tres bloques de lectura —clases, personas y avisos— seguidos de una única confirmación.
3. Durante el turno: exactamente tres controles secundarios; primera clase solo si corresponde y feedback con salida visual hacia Programación.
4. `Finalizar turno`: bloque persistente al final de la pantalla con botón desactivado, contador y `Ver qué falta`; al quedar listo, abre la revisión final y muestra `Entregar turno` o `Cerrar centro` como única acción dominante.

### Checklists y auditoría

- Cada fila mide al menos 44 px y utiliza estado, responsable y hora sin píldoras repetidas.
- Un punto incompleto conserva una acción clara; un punto completado se comprime y muestra su auditoría.
- `Registrar problema` abre un diálogo breve y devuelve al mismo punto sin marcarlo como resuelto.
- El protocolo completo de apertura se consulta en `Protocolos`, fuera de la pantalla principal.
- La checklist final distingue comprobaciones automáticas de registros previos y comprobaciones manuales de sala.
- La nota para el siguiente turno se muestra dentro del cierre como campo opcional.
- Tras cerrar, un resumen desplegable permite revisar apertura y cierre sin convertir el historial en una nueva pantalla.

### Jerarquía adaptativa

- En escritorio, el contenido guiado ocupa una columna principal legible y el resumen puede acompañarlo sin crear acciones paralelas.
- En móvil, todo sigue una lectura lineal: progreso, momento actual, acción y finalización.
- La cabecera y navegación permanecen oscuras; el área de trabajo continúa clara con blanco, lila y amarillo cálido.
- El morado se reserva para la acción actual y el amarillo para el foco puntual.
- Se retiran de la interfaz los nombres `Información especial`, `Feedback operativo`, `Casos especiales` y `Briefing especial`.
