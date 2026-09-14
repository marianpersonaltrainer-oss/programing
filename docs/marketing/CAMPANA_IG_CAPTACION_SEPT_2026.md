# Campaña Instagram · Captación de leads · Septiembre 2026

Evolution Boutique Fitness · Granada
Versión 3, objetivo valoración inicial · 23 de agosto de 2026

## 1. La estrategia en una idea

El objetivo de la campaña no es que te escriban. Es que reserven una valoración inicial. Eso cambia el embudo, porque la valoración no es un regalo: cuesta 20 € y va precedida de un formulario de nueve preguntas, con compromiso mínimo de tres meses y rango de inversión mensual incluidos.

Eso está muy bien. Filtra fortísimo y hace que las valoraciones que llegan sean de gente que va en serio. Pero no se puede pedir en frío. Alguien que ve un vídeo tuyo por primera vez no va a pagar 20 € y contestar nueve preguntas sobre sus lesiones y su presupuesto.

Por eso el orden importa tanto:

**El vídeo abre. La conversación cualifica. Calendly cierra.**

Calendly no es la puerta de entrada, es la puerta de salida. El enlace se manda cuando ya has hablado con la persona y hay encaje. Ahí las nueve preguntas dejan de ser un obstáculo y pasan a ser lo que son, una preparación de la cita.

| Peldaño | Quién es | Qué ve | A dónde va |
|---|---|---|---|
| Frío | Gente de Granada que no te conoce | Vídeo corto de sala real | WhatsApp |
| Templado | Vio la mitad de un vídeo o interactuó, pero no escribió | Otro vídeo distinto | Landing |
| Caliente | Visitó la landing y no escribió | Anuncio simple, sin vídeo | WhatsApp o Calendly |

En Meta esta escalera se monta con dos conjuntos de anuncios, no con tres. Con 17,50 € al día no da para más, y partir el presupuesto impide que ninguno salga de la fase de aprendizaje.

## 2. Qué papel juega cada activo

**Los vídeos.** Son lo más valioso que tienes, y no por lo que enseñan. Cada persona que ve la mitad de un vídeo entra automáticamente en un público de retargeting. Con dos semanas de vídeo en frío tendrás una lista de gente interesada de Granada a la que impactar barato en las semanas 3 y 4. Ese público no se puede comprar, se fabrica.

**La landing.** No sirve para convencer a un desconocido. Sirve para quitar dudas a alguien que ya te ha visto. Las preguntas que resuelve, dónde estáis, cómo es una clase, para quién es, son exactamente las que tiene alguien que ya vio un vídeo y se lo está pensando. Por eso va en el peldaño templado, no en el frío.

**WhatsApp.** Es donde EVO gana. Meta mide de forma nativa cuántas conversaciones se inician, sin depender del píxel, así que optimiza bien aunque el presupuesto sea pequeño. Es el destino del tráfico frío.

**Calendly.** Es el cierre, no la captación. Su formulario largo y el coste de 20 € son un filtro excelente en el momento correcto y un muro en el momento equivocado. Solo se enseña a quien ya ha hablado contigo, o a quien llega desde la landing habiendo visto ya varios vídeos.

## 3. Tu Calendly, lo que hay y lo que cambiaría

Ya tienes montadas dos valoraciones, y están bien planteadas.

| | Presencial | Online |
|---|---|---|
| Duración | 30 minutos | 30 minutos |
| Lugar | C/ San Vicente Ferrer 6, Granada Centro | Videollamada |
| Coste | 20 €, descontables si se incorpora | 20 €, descontables si se incorpora |
| Formulario | 9 preguntas, casi todas obligatorias | Las mismas, con el teléfono opcional |

**Para la campaña se usa solo la presencial.** Estás anunciando en un radio de 8 km sobre Granada, así que la gente puede venir. Ver la sala y conocerte en persona convierte mucho mejor que una videollamada. La online se reserva para quien te diga en la conversación que no puede desplazarse.

**Lo que sí cambiaría, por orden de importancia:**

1. **Cobrar los 20 € al reservar.** Ahora mismo el evento no tiene pago activado en Calendly, así que el coste está anunciado en la descripción pero no se cobra al reservar. Eso significa que el compromiso es solo declarativo y las ausencias van a doler. Conectando Stripe o PayPal en Calendly, el hueco solo se bloquea cuando alguien ha pagado. Es el cambio con más impacto de toda la campaña: convierte una lista de reservas en una lista de citas reales.
2. **Añadir parámetros UTM a los enlaces.** Calendly guarda los UTM que le llegan en la dirección y te los muestra en cada cita. Con eso sabes qué anuncio concreto ha traído cada valoración, sin depender de que la persona conteste bien.
3. **Dejar el teléfono obligatorio también en la online.** Ahora es opcional ahí y obligatorio en la presencial. Si alguien no aparece, sin teléfono no puedes recuperarlo.
4. **Recordatorios.** Uno a las 24 horas y otro a las 2 horas antes. En citas de pago pequeño es lo que separa un 60 % de asistencia de un 90 %.

La pregunta «¿Cómo nos has conocido?» ya tiene Instagram entre las opciones, así que la atribución básica la tienes cubierta desde el primer día.

## 4. Comprobar el píxel antes de arrancar

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

## 5. Datos que hay que confirmar

Tu Calendly ya ha resuelto dos de los huecos que tenía marcados:

- **Oferta:** valoración inicial presencial de 30 minutos, 20 € descontables si se incorpora. Confirmado.
- **Ubicación:** C/ San Vicente Ferrer 6, Granada Centro. Confirmado.

Quedan estos, que no aparecen en ninguna fuente que yo pueda ver:

- `[CUOTA]`: la cuota mensual real. El formulario de Calendly pregunta por rangos de 85 a 120 € y de más de 120 €, pero eso es una pregunta de cualificación, no tu tarifa. No la doy por buena ni la escribo en ningún anuncio hasta que me la confirmes.
- `[HORARIOS]`: franjas reales con plazas libres en septiembre.
- `[ENLACE WA]`: enlace `wa.me` del número de EVO.
- `[URL LANDING]`: dirección de la landing.
- `[PLAZAS]`: solo si de verdad hay un número limitado de plazas. Si no lo hay, no se menciona.

Regla: si un dato no está confirmado, se quita del anuncio. Un anuncio que promete algo que luego no existe cuesta más caro que un anuncio flojo.

## 6. Estructura en Meta Ads

### 6.1 Campaña

- Objetivo: Clientes potenciales (Leads)
- Presupuesto a nivel de campaña (CBO), 17,50 € al día
- Categoría especial de anuncios: ninguna
- Fechas: 1 al 28 de septiembre

### 6.2 Conjunto 1 · Frío Granada (semanas 1 a 4)

| Ajuste | Valor |
|---|---|
| Destino | WhatsApp |
| Presupuesto | 17,50 € al día en semanas 1 y 2, 12,50 € a partir de la 3 |
| Ubicación | Granada capital, radio de 8 km desde San Vicente Ferrer 6 |
| Tipo | Personas que viven en este lugar |
| Edad | 25 a 55 |
| Género | Todos |
| Segmentación detallada | Ninguna, público amplio |
| Ubicaciones del anuncio | Advantage+ (automáticas) |
| Optimización | Conversaciones |
| Creatividades | Vídeos A, B, C y D |
| Exclusión | Quien ya ha iniciado una conversación |

El público amplio funciona mejor que los intereses en zonas pequeñas. En un radio de 8 km sobre Granada la geografía ya limita el alcance, y añadir intereses de fitness lo estrecha hasta que el coste sube.

### 6.3 Conjunto 2 · Retargeting (semanas 3 y 4)

| Ajuste | Valor |
|---|---|
| Presupuesto | 5 € al día |
| Público | Personalizado, combinando: quien ha visto el 50 % o más de cualquier vídeo en 30 días, quien ha interactuado con la cuenta de Instagram en 365 días, y visitantes de la landing en 180 días si hay píxel |
| Exclusión | Quien ya ha iniciado una conversación |
| Creatividades | Anuncio E, con dos versiones |
| Destino | Versión 1 a la landing, versión 2 a WhatsApp |

Aquí van juntos los peldaños templado y caliente, porque por separado el público sería demasiado pequeño para gastar. Meta reparte solo entre las dos versiones. Este conjunto suele dar el coste por conversación más bajo de toda la campaña.

## 7. Cómo usar los vídeos

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

## 8. Los cinco anuncios

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
**Descripción:** Valoración inicial de 30 minutos
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

## 9. Qué ajustar en la landing

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

## 10. Lo que no se puede publicar

Las políticas de Meta sobre salud y forma física son estrictas, y un anuncio rechazado frena la campaña varios días. Además, nada de esto encaja con la voz de EVO.

- Fotos de antes y después, o montajes que las imiten
- Atributos personales. No se escribe «¿te sobran kilos?» ni nada que dé por hecho el estado físico de quien lee
- Resultados garantizados, cifras de pérdida de peso o plazos prometidos
- Primeros planos de zonas corporales aisladas
- Urgencia inventada. Si no hay plazas limitadas de verdad, no se dice
- Mayúsculas para gritar y acumulación de exclamaciones

## 11. Qué pasa cuando escriben

El anuncio abre la puerta, la conversación cualifica y Calendly cierra. Esta parte es la que decide la campaña.

**Paso 1. Primer mensaje, en menos de 2 horas:**

> Hola, `[NOMBRE]`, ¿qué tal? Soy Marian, de Evolution 😊
>
> Me alegra que te hayas animado a escribir.
>
> Para orientarte bien, cuéntame una cosa primero: ¿qué te gustaría conseguir entrenando?

**Paso 2. Después de su respuesta:** reconoce lo que ha contado y haz una sola pregunta más. Normalmente: si ha entrenado antes, o qué franja horaria le encaja. Una pregunta cada vez.

**Paso 3. Comprobar encaje.** Antes de mandar el enlace, tienes que saber tres cosas: qué busca, si puede venir a los horarios que hay libres, y si la inversión le encaja. Si algo de eso no cuadra, es mejor decirlo ahora que en la valoración.

**Paso 4. Mandar el enlace.** Solo cuando hay encaje:

> Por lo que me cuentas, creo que podemos ayudarte.
>
> El siguiente paso es una valoración inicial. Son 30 minutos aquí en el centro, en San Vicente Ferrer 6, para ver tu punto de partida y decirte con claridad cómo empezarías.
>
> Tiene un coste de 20 € que se te descuenta si decides incorporarte.
>
> Coge aquí el hueco que mejor te venga: `[ENLACE CALENDLY]`

**Paso 5. Si reserva pero no ha pagado**, y todavía no tienes el cobro activado en Calendly, confirma el pago por mensaje el día antes. Es incómodo y es justo la razón por la que conviene activar el cobro en la reserva.

**Paso 6. Si no contesta:** un único seguimiento a las 48 horas, corto y sin presión. Si tampoco responde, se deja estar. No hay tercer mensaje.

**Sobre los 20 €:** no hace falta ponerlos en el anuncio, pero sí decirlos en cuanto propones la valoración, nunca después. Una persona que se entera del coste al final se siente engañada, y eso no se arregla con un descuento.

**Registro:** cada lead se anota con fecha, por dónde entró según el mensaje pre-escrito, qué buscaba y en qué estado está. Los estados útiles son: escribió, cualificado, reservó, asistió, se dio de alta.

## 12. Contenido orgánico

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

## 13. Medición

El indicador que manda es el coste por valoración asistida, no el coste por conversación. Una campaña con conversaciones baratas y ninguna reserva es una campaña fallida.

**El embudo completo:**

| Paso | De dónde sale el dato |
|---|---|
| Impresiones y clics | Meta Ads |
| Conversaciones iniciadas | WhatsApp |
| Conversaciones cualificadas | Tu registro |
| Valoraciones reservadas | Calendly |
| Valoraciones asistidas | Calendly |
| Altas | Tu registro |

**Un ejemplo con números redondos**, para ver dónde duele:

Con 490 € y un coste de 6 € por conversación salen unas 80 conversaciones. Si una de cada tres reserva valoración, son 26 reservas. Si asiste el 65 %, son 17 valoraciones reales, y el coste por valoración asistida queda en 29 €. Con el cobro activado en la reserva, esa asistencia sube hacia el 90 % y las mismas 26 reservas se convierten en 23 valoraciones, con el coste bajando a 21 €.

Ese salto, de 17 a 23 valoraciones sin gastar un euro más, es lo que compra activar el pago en Calendly.

**Revisión cada lunes, quince minutos:**

| Indicador | Dónde | Señal buena |
|---|---|---|
| Coste por conversación | Meta Ads | Por debajo de 8 € |
| Retención a 3 segundos | Meta Ads | Por encima del 25 % |
| CTR | Meta Ads | Por encima del 1 % |
| Frecuencia | Meta Ads | Por debajo de 2,5 |
| Conversación que reserva | Registro y Calendly | 25 % o más |
| Reserva que asiste | Calendly | 65 % sin cobro, 85 % con cobro |
| Valoración que se da de alta | Registro | Tu dato, no tengo referencia fiable |

Estas cifras son orientativas, basadas en lo habitual en un negocio local de este tamaño. Los números reales de EVO mandan, y desde la segunda semana la comparación se hace contra tus propios datos.

**Reglas de decisión:**

- Si la retención a 3 segundos baja del 20 %, el problema es el arranque del vídeo. Se cambia el principio, no el texto.
- Si la gente ve el vídeo pero no escribe, el problema es el final. Falta decir qué tiene que hacer.
- Si escriben pero no reservan, el problema está en la conversación o en el encaje del público. Mira si te llega gente que no puede venir a tus horarios o a la que no le encaja la inversión.
- Si reservan y no aparecen, el problema es el compromiso. Activa el cobro y los recordatorios.
- Un anuncio con menos del 0,7 % de CTR después de 1.000 impresiones se apaga.
- Si la frecuencia pasa de 3, se cambia la creatividad, no el público.
- No se toca nada durante las primeras 72 horas. Cada cambio reinicia la fase de aprendizaje.

**Sobre la optimización en Meta:** aunque el objetivo del negocio sean las valoraciones, la campaña se sigue optimizando por conversaciones. Con 20 o 30 reservas al mes, Meta nunca tendría suficientes señales para aprender a optimizar por reservas, y la campaña se quedaría atascada. Las conversaciones son la señal barata y frecuente que Meta necesita. Las reservas son el número que miras tú.

## 14. Calendario

| Fecha | Acción |
|---|---|
| 24 al 26 de agosto | Activar el cobro de los 20 € en Calendly, poner recordatorios y dejar obligatorio el teléfono en la valoración online |
| 24 al 27 de agosto | Comprobar el píxel, ajustar la landing con los dos botones, confirmar los datos del punto 5 |
| 24 al 31 de agosto | Publicar tres o cuatro vídeos en orgánico para calentar el público |
| 28 de agosto | Seleccionar y etiquetar los vídeos por papel: gancho, prueba, confianza, ambiente |
| 28 de agosto | Preparar los enlaces de Calendly con UTM, uno por origen |
| 29 de agosto | Cargar la campaña en Meta Ads y dejarla programada |
| 1 de septiembre | Arranque. Conjunto 1 con los cuatro anuncios |
| 8 de septiembre | Primera revisión. Apagar el anuncio más flojo |
| 15 de septiembre | Crear públicos de retargeting, activar el conjunto 2 y bajar el conjunto 1 a 12,50 € |
| 22 de septiembre | Revisión. Subir presupuesto al anuncio que mejor convierte |
| 29 de septiembre | Cierre y balance: coste por valoración asistida, altas conseguidas y coste real por alta |

## 15. Presupuesto

| Partida | Importe |
|---|---|
| Conjunto 1, semanas 1 y 2 | 245 € |
| Conjunto 1, semanas 3 y 4 | 175 € |
| Conjunto 2, retargeting, semanas 3 y 4 | 70 € |
| **Total** | **490 €** |

Con un coste por conversación de entre 5 y 8 €, salen entre 60 y 98 conversaciones. Si una de cada tres reserva, son 20 a 32 valoraciones reservadas. Con el cobro activado y una asistencia del 85 %, quedan entre 17 y 27 valoraciones reales, a un coste de entre 18 y 29 € cada una.

Cuántas de esas se dan de alta es tu dato, no tengo referencia fiable. Si fuera la mitad, serían entre 8 y 13 altas nuevas a un coste de captación de entre 37 y 61 €. Para una cuota mensual recurrente eso se recupera en el primer mes o el segundo.

Son estimaciones, no una previsión. Sirven para decidir si merece la pena arrancar, y se sustituyen por los datos reales en cuanto los haya.
