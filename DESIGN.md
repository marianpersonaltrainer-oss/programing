# DESIGN.md
## Sistema visual de Programming EVO

**Estado:** documento vivo · Fase 2.1 aprobada · Fase 2.2 activa
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
