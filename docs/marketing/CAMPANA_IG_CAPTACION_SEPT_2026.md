# Campaña Instagram · Captación de leads · Septiembre 2026

Evolution Boutique Fitness · Granada
Versión 2, con vídeos y landing · 23 de agosto de 2026

## 1. La estrategia en una idea

Tienes tres cosas: vídeos verticales cortos, una landing que explica EVO y termina en un botón de WhatsApp, y una conversación tuya que convierte muy bien. La estrategia consiste en ponerlas en el orden correcto y no pedirle a ninguna que haga el trabajo de otra.

El error habitual con una landing así es mandarle todo el tráfico frío. La landing añade un paso más antes de la conversación, y cada paso pierde gente. Alguien que no conoce EVO no va a leerse una web entera antes de escribir.

La solución es que el vídeo haga en frío el trabajo que harías con la landing. Un vídeo de 20 segundos filtra igual de bien que una web, cuesta menos y además construye gratis el público al que luego le enseñas la landing.

Queda una escalera de tres peldaños:

| Peldaño | Quién es | Qué ve | A dónde va |
|---|---|---|---|
| Frío | Gente de Granada que no te conoce | Vídeo corto de sala real | WhatsApp directo |
| Templado | Vio la mitad de un vídeo o interactuó con la cuenta, pero no escribió | Otro vídeo distinto | Landing |
| Caliente | Visitó la landing y no escribió | Anuncio simple, sin vídeo | WhatsApp directo |

En Meta esta escalera se monta con dos conjuntos de anuncios, no con tres. Con 17,50 € al día no da para más, y partir el presupuesto en tres impide que ninguno salga de la fase de aprendizaje.

## 2. Qué papel juega cada activo

**Los vídeos.** Son lo más valioso que tienes, y no por lo que enseñan. Cada persona que ve la mitad de un vídeo entra automáticamente en un público de retargeting. Con dos semanas de vídeo en frío tendrás una lista de gente interesada de Granada a la que impactar barato en las semanas 3 y 4. Ese público no se puede comprar, se fabrica.

**La landing.** No sirve para convencer a un desconocido. Sirve para quitar dudas a alguien que ya te ha visto. Las preguntas que resuelve, dónde estáis, cómo es una clase, para quién es, son exactamente las que tiene alguien que ya vio un vídeo y se lo está pensando. Por eso va en el peldaño templado, no en el frío.

**WhatsApp.** Es donde EVO gana. Meta mide de forma nativa cuántas conversaciones se inician, sin depender del píxel, así que optimiza muy bien aunque el presupuesto sea pequeño. Es el destino del tráfico frío y del caliente.

## 3. Comprobar el píxel antes de arrancar

Hay que saber si la landing tiene píxel y si registra algo útil. Sin esto no se puede hacer retargeting de visitantes ni saber qué anuncio trae gente que llega hasta el botón.

**Cómo comprobarlo, en diez minutos:**

1. Instala la extensión Meta Pixel Helper en Chrome y abre tu landing. Te dirá si hay píxel y con qué identificador.
2. Entra en el Administrador de eventos de Meta, apartado Orígenes de datos, y mira si hay actividad en los últimos días.
3. Usa la herramienta Probar eventos: pegas la dirección de la landing, navegas por ella y ves en tiempo real qué llega.

**Qué hace falta como mínimo:**

- `PageView`: se activa solo con el píxel instalado. Sirve para el público de visitantes.
- Un evento personalizado al pulsar el botón de WhatsApp. Nombre propuesto: `ClicWhatsApp`. Este es el importante, porque es el único que distingue entre alguien que pasó por la landing y alguien que dio el paso.

**Si no hay píxel:** se instala antes del 1 de septiembre. Si por lo que sea no llega a tiempo, la campaña arranca igual, pero el peldaño caliente se cae y el retargeting se hace solo con quien ha visto vídeos, que ya es bastante.

Un aviso: los anuncios que van directos a WhatsApp no pasan por la web, así que no alimentan el píxel. Todo tu público de retargeting web vendrá del peldaño templado. Es normal, no es un fallo de configuración.

## 4. Datos que hay que confirmar

Estos huecos aparecen marcados en todos los textos. No he inventado ninguno.

- `[OFERTA]`: qué recibe exactamente quien escribe. Propuesta: valoración inicial gratuita más una clase de prueba.
- `[PRECIO]`: si se menciona precio o cuota de inicio, y cuál.
- `[HORARIOS]`: franjas reales con plazas libres en septiembre.
- `[ENLACE WA]`: enlace `wa.me` del número de EVO.
- `[URL LANDING]`: dirección de la landing.
- `[UBICACION]`: dirección o barrio que se nombra en los anuncios.
- `[PLAZAS]`: solo si de verdad hay un número limitado. Si no lo hay, no se menciona.

Regla: si un dato no está confirmado, se quita del anuncio. Un anuncio que promete algo que luego no existe cuesta más caro que un anuncio flojo.

## 5. Estructura en Meta Ads

### 5.1 Campaña

- Objetivo: Clientes potenciales (Leads)
- Presupuesto a nivel de campaña (CBO), 17,50 € al día
- Categoría especial de anuncios: ninguna
- Fechas: 1 al 28 de septiembre

### 5.2 Conjunto 1 · Frío Granada (semanas 1 a 4)

| Ajuste | Valor |
|---|---|
| Destino | WhatsApp |
| Presupuesto | 17,50 € al día en semanas 1 y 2, 12,50 € a partir de la 3 |
| Ubicación | Granada capital, radio de 8 km desde `[UBICACION]` |
| Tipo | Personas que viven en este lugar |
| Edad | 25 a 55 |
| Género | Todos |
| Segmentación detallada | Ninguna, público amplio |
| Ubicaciones del anuncio | Advantage+ (automáticas) |
| Optimización | Conversaciones |
| Creatividades | Vídeos A, B, C y D |
| Exclusión | Quien ya ha iniciado una conversación |

El público amplio funciona mejor que los intereses en zonas pequeñas. En un radio de 8 km sobre Granada la geografía ya limita el alcance, y añadir intereses de fitness lo estrecha hasta que el coste sube.

### 5.3 Conjunto 2 · Retargeting (semanas 3 y 4)

| Ajuste | Valor |
|---|---|
| Presupuesto | 5 € al día |
| Público | Personalizado, combinando: quien ha visto el 50 % o más de cualquier vídeo en 30 días, quien ha interactuado con la cuenta de Instagram en 365 días, y visitantes de la landing en 180 días si hay píxel |
| Exclusión | Quien ya ha iniciado una conversación |
| Creatividades | Anuncio E, con dos versiones |
| Destino | Versión 1 a la landing, versión 2 a WhatsApp |

Aquí van juntos los peldaños templado y caliente, porque por separado el público sería demasiado pequeño para gastar. Meta reparte solo entre las dos versiones. Este conjunto suele dar el coste por conversación más bajo de toda la campaña.

## 6. Cómo usar los vídeos

No todos los vídeos valen para lo mismo. Repártelos por función, no por cuál te gusta más.

| Papel | Duración | Qué tiene que hacer | Dónde va |
|---|---|---|---|
| Gancho frío | 15 a 25 s | Que alguien que no te conoce pare de deslizar y entienda en tres segundos de qué va esto | Conjunto 1 |
| Prueba | 20 a 30 s | Enseñar sala real, grupo pequeño, entrenador corrigiendo | Conjunto 1 |
| Confianza | 30 a 45 s | Un cliente contando de dónde partía, o tú explicando cómo trabajáis | Conjunto 2, versión landing |
| Ambiente | 15 a 25 s | Comunidad, gente hablando, el momento de terminar | Conjunto 1 y orgánico |

**Reglas para cualquiera de ellos:**

- Los tres primeros segundos deciden. Empieza por la imagen más concreta que tengas, no por el logotipo ni por una intro.
- Se ven sin sonido. Subtítulos siempre, en Montserrat, con fondo o sombra sólida.
- Nada importante en los 250 px superiores ni en los 300 px inferiores. Ahí se colocan los elementos de la interfaz de Instagram.
- Una sola idea por vídeo. Si el vídeo explica tres cosas, no explica ninguna.
- Sin música épica ni transiciones decorativas. La energía de EVO se construye con personas reales y contraste, no con efectos.

Si tienes menos vídeos de los que pide la tabla, prioriza así: primero gancho frío, después prueba. Con esos dos ya se puede arrancar. Confianza y ambiente pueden entrar en la semana 2.

## 7. Los cinco anuncios

Los cuatro primeros salen a la vez el 1 de septiembre en el conjunto 1. En la semana 2 se apaga el que peor rinda. El quinto es del conjunto 2.

### Especificaciones visuales

Vertical 1080 x 1920 px para vídeo, 1080 x 1350 px para imagen. Margen seguro de 80 px. Titular en Oswald Bold, mayúsculas, máximo seis palabras. Cuerpo y subtítulos en Montserrat. Fondo negro `#0C0B0C` o morado `#6A1F6D` con capa oscura al 45-70 % sobre foto. Amarillo `#FFFF4C` solo en una palabra o un subrayado. Personas reales de EVO, nunca banco de imágenes.

### Anuncio A · Empezar desde cero

**Vídeo:** gancho frío. Gente real entrenando con técnica tranquila, no en máximo esfuerzo.
**Destino:** WhatsApp.

**Texto principal:**

> Hay una idea que frena a mucha gente: pensar que hay que estar en forma antes de venir a entrenar.
>
> En Evolution trabajamos a diario con personas que empiezan de cero. Grupos reducidos, un entrenador pendiente de ti y ejercicios adaptados a lo que tu cuerpo puede hacer hoy.
>
> Si llevas tiempo dándole vueltas, escríbenos y hablamos sin compromiso. Te preguntamos qué buscas y te decimos con sinceridad si podemos ayudarte.

**Titular:** Empezar de cero también es empezar bien
**Descripción:** Grupos reducidos en Granada
**Botón:** Enviar mensaje de WhatsApp

**Texto en pantalla:**
- 0-3 s: EMPEZAR DE CERO
- 4-10 s: Grupos reducidos. Un entrenador contigo.
- 11-16 s: Adaptamos el ejercicio a ti, no al revés.
- 17-20 s: Escríbenos y hablamos

### Anuncio B · Volver después de un parón

**Vídeo:** prueba. Sala real, un grupo entrenando, tú corrigiendo a alguien.
**Destino:** WhatsApp.

**Texto principal:**

> Septiembre siempre trae la misma frase: este año sí.
>
> Si llevas meses o años sin entrenar, lo primero no es apretar. Es volver con cabeza, sin lesionarte y con alguien que te corrija desde el primer día.
>
> Eso es lo que hacemos en Evolution. Entrenamiento guiado en grupos pequeños, aquí en Granada.
>
> Cuéntanos por WhatsApp desde dónde partes y te orientamos.

**Titular:** Volver a entrenar, con cabeza
**Descripción:** `[OFERTA]`
**Botón:** Enviar mensaje de WhatsApp

### Anuncio C · Ya entrena, pero va solo

**Vídeo:** prueba, con foco en el trabajo de fuerza y técnica.
**Destino:** WhatsApp.

**Texto principal:**

> Entrenas, pero vas por libre y no sabes si estás avanzando o solo repitiendo.
>
> En Evolution la semana está programada: cada sesión tiene una intención y una relación con la anterior. Fuerza, técnica y trabajo metabólico se complementan en vez de acumularse sin sentido.
>
> Si quieres que alguien lleve el timón de tu entrenamiento, escríbenos y te contamos cómo trabajamos 💪

**Titular:** Tu entrenamiento, con un plan detrás
**Descripción:** Método EVO en grupos reducidos
**Botón:** Enviar mensaje de WhatsApp

### Anuncio D · Comunidad

**Vídeo:** ambiente. Gente hablando antes de clase, chocando la mano al terminar, risas.
**Destino:** WhatsApp.

**Texto principal:**

> Mucha gente aguanta entrenando por lo que se encuentra al llegar, no por lo que quema.
>
> En Evolution entrenas en grupos pequeños, con caras conocidas y un entrenador que sabe tu nombre y por dónde vas.
>
> Si buscas un sitio donde te esperen, escríbenos y te invitamos a conocerlo 🫶🏼

**Titular:** Este es mi sitio
**Descripción:** Comunidad EVO en Granada
**Cierre manuscrito:** *tu momento*

### Anuncio E · Retargeting, dos versiones

**Versión 1, a la landing.** Vídeo de confianza, el más largo que tengas.

> Nos has visto por aquí estos días.
>
> Si te ha quedado la duda de si Evolution encaja contigo, aquí te contamos cómo trabajamos, dónde estamos y cómo es una clase por dentro.
>
> Échale un vistazo con calma.

**Titular:** Mira cómo trabajamos
**Descripción:** Evolution Boutique Fitness, Granada
**Botón:** Más información
**Destino:** `[URL LANDING]`

**Versión 2, a WhatsApp.** Imagen vertical sencilla, fondo lila `#F6E8F9`, texto negro, botón morado.

> Nos has visto por aquí estos días.
>
> Si te ha quedado la duda de si Evolution encaja contigo, la forma más rápida de salir de dudas es preguntar. Nos cuentas qué buscas y qué horarios te sirven, y te decimos con sinceridad si podemos ayudarte.
>
> Sin compromiso y sin insistir después.

**Titular:** ¿Te lo estás pensando?
**Descripción:** Escríbenos y lo vemos
**Botón:** Enviar mensaje de WhatsApp

## 8. Qué ajustar en la landing

La landing va a recibir gente templada, no fría. Eso cambia lo que tiene que hacer.

**Lo imprescindible:**

- **Correspondencia con el anuncio.** El titular de la landing tiene que decir lo mismo que decía el anuncio del que viene. Si el anuncio habla de volver tras un parón y la landing abre hablando de rendimiento, la persona se va en dos segundos.
- **Botón de WhatsApp fijo en móvil.** Visible sin bajar, y repetido al final. Casi todo el tráfico va a ser móvil.
- **Una sola acción.** Si hay botón de WhatsApp, formulario, teléfono y enlace a Instagram compitiendo, ninguno gana.
- **Lo primero que se ve responde a tres cosas:** para quién es esto, dónde está y qué pasa si escribo.
- **Velocidad.** Vídeos comprimidos y sin reproducción automática pesada. Cada segundo de carga se lleva gente por delante.

**Un truco de medición que no cuesta nada:**

Usa enlaces `wa.me` distintos según de dónde viene la persona, cambiando el mensaje que aparece ya escrito:

- Desde la landing: «Hola, vengo de la web y quiero información»
- Desde el anuncio directo: «Hola, vengo de Instagram y quiero información»
- Desde la biografía del perfil: «Hola, os he visto en Instagram»

Así, en cuanto llega el mensaje, sabes por dónde ha entrado sin depender de ninguna herramienta. Añade también parámetros UTM a las direcciones de la landing en los anuncios, para poder distinguirlas en el futuro.

## 9. Lo que no se puede publicar

Las políticas de Meta sobre salud y forma física son estrictas, y un anuncio rechazado frena la campaña varios días. Además, nada de esto encaja con la voz de EVO.

- Fotos de antes y después, o montajes que las imiten
- Atributos personales. No se escribe «¿te sobran kilos?» ni nada que dé por hecho el estado físico de quien lee
- Resultados garantizados, cifras de pérdida de peso o plazos prometidos
- Primeros planos de zonas corporales aisladas
- Urgencia inventada. Si no hay plazas limitadas de verdad, no se dice
- Mayúsculas para gritar y acumulación de exclamaciones

## 10. Qué pasa cuando escriben

El anuncio solo abre la puerta. Aquí se gana o se pierde el cliente.

**Primer mensaje, en menos de 2 horas:**

> Hola, `[NOMBRE]`, ¿qué tal? Soy Marian, de Evolution 😊
>
> Me alegra que te hayas animado a escribir.
>
> Para orientarte bien, cuéntame una cosa primero: ¿qué te gustaría conseguir entrenando?

**Después de su respuesta:** reconoce lo que ha contado y haz una sola pregunta más. Normalmente: si ha entrenado antes, o qué franja horaria le encaja. Una pregunta cada vez.

**Propuesta:** relaciona lo que ha dicho con algo concreto de EVO y propón el siguiente paso, que es `[OFERTA]`. Una sola llamada a la acción.

**Si no contesta:** un único seguimiento a las 48 horas, corto y sin presión. Si tampoco responde, se deja estar. No hay tercer mensaje.

**Registro:** cada lead se anota con fecha, por dónde entró según el mensaje pre-escrito, qué buscaba y en qué estado está. Sin esto no se puede saber qué anuncio trae gente que de verdad se da de alta.

## 11. Contenido orgánico

Los vídeos tienen que empezar a trabajar antes que los anuncios. Cada persona que ve un reel tuyo en orgánico entra en el público de retargeting, y eso es presupuesto que no gastas.

**Del 24 al 31 de agosto, calentar:**

- Publica tres o cuatro de tus vídeos en el perfil, uno cada dos días.
- Deja el perfil listo: biografía con qué haces, dónde estás y para quién es, enlace a la landing, y destacados de Método, Horarios, Instalaciones y Empezar aquí.
- Las tres últimas publicaciones deben responder a «¿esto es para mí?».

**Durante la campaña, tres publicaciones por semana:**

| Semana | Lunes | Miércoles | Viernes |
|---|---|---|---|
| 1 · Quiénes somos | Reel de presentación de sala y equipo | Carrusel: cómo es una clase de principio a fin | Grupos reducidos y por qué importan |
| 2 · Qué te frena | Reel: «no estoy en forma para ir a un sitio así» | Carrusel: tres errores al volver tras un parón | Cliente contando su arranque, con su permiso |
| 3 · Cómo trabajamos | Reel: por qué la semana está programada | Carrusel: las clases de EVO y para quién es cada una | Entrenamiento corregido en directo, foco en técnica |
| 4 · Siguiente paso | Reel de ambiente de comunidad | Preguntas frecuentes reales de este mes | Recordatorio de `[HORARIOS]` con plazas libres |

**Stories, a diario:** trozos de clase, una encuesta a la semana, caja de preguntas los jueves y respuesta pública a la duda más repetida.

## 12. Medición

Revisión cada lunes por la mañana, quince minutos.

| Indicador | Dónde se mira | Señal buena |
|---|---|---|
| Coste por conversación | Meta Ads | Por debajo de 8 € |
| Retención a 3 segundos del vídeo | Meta Ads | Por encima del 25 % |
| Reproducciones de 15 segundos o ThruPlay | Meta Ads | Suficientes para llenar el público de retargeting |
| CTR | Meta Ads | Por encima del 1 % |
| Frecuencia | Meta Ads | Por debajo de 2,5 |
| Conversaciones iniciadas | WhatsApp | 18 a 28 por semana |
| Leads que reservan valoración | Registro propio | 40 % o más |
| Valoraciones que se dan de alta | Registro propio | 40 % o más |

Estas cifras son orientativas, basadas en lo habitual en un negocio local de este tamaño. Los números reales de EVO mandan, y desde la segunda semana la comparación se hace contra tus propios datos.

**Reglas de decisión:**

- Si la retención a 3 segundos baja del 20 %, el problema es el arranque del vídeo. Se cambia el principio, no el texto.
- Si la gente ve el vídeo pero no escribe, el problema es el final. Falta decir claramente qué tiene que hacer.
- Un anuncio con menos del 0,7 % de CTR después de 1.000 impresiones se apaga.
- Si la frecuencia pasa de 3, se cambia la creatividad, no el público.
- No se toca nada durante las primeras 72 horas. Cada cambio reinicia la fase de aprendizaje.
- Si el coste por conversación pasa de 12 € en la semana 2, se revisa primero la creatividad y después el público.
- Si en el conjunto 2 la versión de la landing trae menos conversaciones que la de WhatsApp, se le baja el peso. La landing está para quitar dudas, no para competir.

## 13. Calendario

| Fecha | Acción |
|---|---|
| 24 al 27 de agosto | Comprobar el píxel, ajustar la landing, confirmar los datos del punto 4 |
| 24 al 31 de agosto | Publicar tres o cuatro vídeos en orgánico para calentar el público |
| 28 de agosto | Seleccionar y etiquetar los vídeos por papel: gancho, prueba, confianza, ambiente |
| 29 de agosto | Cargar la campaña en Meta Ads y dejarla programada |
| 1 de septiembre | Arranque. Conjunto 1 con los cuatro anuncios |
| 8 de septiembre | Primera revisión. Apagar el anuncio más flojo |
| 15 de septiembre | Crear públicos de retargeting, activar el conjunto 2 y bajar el conjunto 1 a 12,50 € |
| 22 de septiembre | Revisión. Subir presupuesto al anuncio que mejor convierte |
| 29 de septiembre | Cierre y balance: coste por lead, altas conseguidas y coste real por alta |

## 14. Presupuesto

| Partida | Importe |
|---|---|
| Conjunto 1, semanas 1 y 2 | 245 € |
| Conjunto 1, semanas 3 y 4 | 175 € |
| Conjunto 2, retargeting, semanas 3 y 4 | 70 € |
| **Total** | **490 €** |

Con un coste por conversación de entre 5 y 8 €, salen entre 60 y 98 leads. Si de esos se da de alta el 20 %, son 12 a 19 altas nuevas. El coste de captación por alta queda entre 26 y 41 €, que para una cuota mensual recurrente se recupera pronto.

Son estimaciones, no una previsión. Sirven para decidir si merece la pena arrancar, y se sustituyen por los datos reales en cuanto los haya.
