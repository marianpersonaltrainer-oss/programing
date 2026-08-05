# DESIGN.md
## Sistema visual de Programming EVO

**Estado:** documento vivo · Fase 2.2 aprobada · Fase 2.3 reajustada tras auditoría de servicio y pendiente de revisión
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

## Patrón de briefing y asistente contextual de Mi turno

La pantalla principal representa un recorrido y no un tablero. Solo el momento actual tiene protagonismo; el sistema registra el estado sin convertir cada comprobación rutinaria en un botón.

### Cuatro momentos

1. `Iniciar turno`: una tarjeta clara registra la entrada y el turno asignado. Si es el primer turno, aparece un recordatorio compacto y una sola acción `Centro abierto y operativo`; si recibe relevo, avanza al briefing.
2. `Preparar mi turno`: una única pantalla agrupa clases, personas, adaptaciones, incidencias, feedback previo y relevo. Las tarjetas de clase abren Programación y una sola acción confirma `He revisado y preparado mi turno`.
3. Durante el turno: no hay checklist permanente. Las acciones aparecen en contexto de la siguiente clase o excepción y desaparecen cuando dejan de ser pertinentes.
4. Al finalizar: `Entregar turno` es un relevo breve sin checklist de cierre; `Cerrar centro` muestra la checklist detallada solo al último entrenador.

Antes de trabajar hay como máximo dos confirmaciones en el primer turno y una al recibir relevo.

### Registro y auditoría

- Apertura, briefing, acciones relevantes, entrega y cierre guardan responsable y hora sin repetir metadatos en cada tarjeta.
- `Registrar un problema` es una acción secundaria. Un problema encontrado al abrir se etiqueta `Cierre anterior`, conserva evidencia y vínculo local con el turno previo cuando existe.
- Una incidencia de cierre anterior solo frena el inicio si afecta a la seguridad o impide prestar el servicio.
- Programación contiene el detalle y el feedback de cada clase; Operativa enlaza y conserva únicamente la continuidad del recorrido.
- Personas nuevas, adaptaciones e incidencias son información prioritaria, no una lista que marcar.
- La checklist detallada solo aparece para cerrar el último turno e incluye material, sala, baños, limpieza, sistemas, dispositivos, incidencias y acceso.
- La entrega muestra relevo, incidencias activas, sala preparada y pendientes en un resumen breve con una única confirmación final.
- Tras finalizar, un resumen revisable conserva la trazabilidad sin crear un historial completo nuevo.
- Los diálogos reciben foco al abrirse, admiten `Escape` y restituyen el foco cuando el origen continúa disponible.

### Jerarquía adaptativa

- En escritorio, el contenido guiado ocupa una columna principal legible y el resumen puede acompañarlo sin crear acciones paralelas.
- En móvil, todo sigue una lectura lineal: progreso, momento actual, acción y finalización.
- La cabecera y navegación permanecen oscuras; el área de trabajo continúa clara con blanco, lila y amarillo cálido.
- El morado se reserva para la acción actual y el amarillo para el foco puntual.
- Se retiran de la interfaz los nombres `Información especial`, `Feedback operativo`, `Casos especiales` y `Briefing especial`.
