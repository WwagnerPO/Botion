/**
 * Emojis para el icono de las notas y el comando «/Emoji», con palabras en
 * español para buscarlos. Cada línea: emoji y palabras separadas por espacios.
 */
const DATA: Record<string, string> = {
  Caras: `
😀 cara sonrisa feliz alegre
😃 sonrisa contento
😄 risa alegre
😁 sonrisa dientes
😆 carcajada risa
😅 sudor nervios risa
🤣 carcajada suelo
😂 lágrimas risa
🙂 sonrisa leve
😉 guiño
😊 sonrojado feliz
😇 ángel inocente
🥰 enamorado corazones
😍 ojos corazón amor
🤩 estrellas emocionado
😘 beso
😋 rico delicioso
😎 gafas guay
🤓 empollón gafas
🧐 monóculo curioso
🤔 pensando duda
🤨 ceja sospecha
😐 neutral serio
😴 dormido sueño
😪 sueño cansado
😮 sorpresa
😲 asombro
😳 vergüenza sonrojo
🥺 suplicar pena
😢 llorar triste
😭 llanto
😤 enfado bufido
😡 furioso enfadado
🤯 explota cabeza
😱 grito miedo
🥳 fiesta celebrar
🤗 abrazo
🤫 silencio secreto
🙄 ojos en blanco
😬 mueca
🤒 enfermo fiebre
🤠 vaquero
👻 fantasma
💀 calavera
🤖 robot
👽 alien extraterrestre
💩 caca
`,
  Gestos: `
👍 bien ok pulgar sí
👎 mal no pulgar
👏 aplauso
🙌 celebrar manos
🙏 gracias por favor rezar
🤝 acuerdo trato apretón
✌️ paz victoria
🤞 suerte dedos cruzados
👌 perfecto ok
👋 hola adiós saludo
✋ alto mano
💪 fuerza músculo
👀 ojos mirar
🧠 cerebro mente idea
❤️ corazón amor rojo
🧡 corazón naranja
💛 corazón amarillo
💚 corazón verde
💙 corazón azul
💜 corazón morado
🖤 corazón negro
💔 corazón roto
💯 cien perfecto
💥 explosión
✨ brillo estrellas magia
🔥 fuego llama
⭐ estrella favorito
🌟 estrella brillante
⚡ rayo energía
💡 bombilla idea
`,
  Trabajo: `
📝 nota apuntes escribir
📄 documento página
📃 página
📑 marcadores pestañas
📋 portapapeles lista
📌 chincheta fijar
📍 ubicación pin
📎 clip adjunto
🔗 enlace link
📁 carpeta
📂 carpeta abierta
🗂️ fichero archivador
🗃️ caja archivo
🗄️ archivador
📅 calendario fecha
📆 calendario
🗓️ agenda calendario
⏰ alarma reloj
⏳ reloj arena tiempo
⌛ tiempo
📊 gráfico barras estadística
📈 gráfico subida crecimiento
📉 gráfico bajada
💼 maletín trabajo negocio
🏢 oficina empresa
✅ hecho completado tarea
☑️ casilla tarea
❌ error no cruz
⚠️ aviso cuidado advertencia
❓ pregunta duda
❗ importante exclamación
🚩 bandera señal
🎯 objetivo meta diana
🏆 trofeo premio
🥇 medalla oro primero
🔑 llave clave
🔒 candado privado
🔓 abierto
🔍 buscar lupa
🔔 campana aviso notificación
📣 megáfono anuncio
📢 altavoz
💬 mensaje chat
💭 pensamiento
📧 email correo
✉️ sobre carta correo
📮 buzón
📦 paquete caja
🧾 recibo factura
💰 dinero bolsa
💶 euro billete dinero
💳 tarjeta pago
🛒 carrito compra
`,
  Tecnología: `
💻 portátil ordenador código
🖥️ ordenador pantalla
⌨️ teclado
🖱️ ratón
📱 móvil teléfono
☎️ teléfono
🔋 batería
🔌 enchufe
💾 disquete guardar
💿 disco
📷 cámara foto
🎥 cámara vídeo
📺 televisión
🎧 auriculares música
🎮 videojuego mando
🕹️ joystick juego
🤖 robot bot ia
⚙️ engranaje ajustes configuración
🛠️ herramientas
🔧 llave inglesa arreglar
🔨 martillo
🧪 tubo ensayo experimento
🧬 adn ciencia
🔬 microscopio
🔭 telescopio
🛰️ satélite
🚀 cohete lanzamiento proyecto
🧩 puzle pieza
🐛 bicho bug error
`,
  Naturaleza: `
🌱 planta brote crecer
🌿 hierba hoja
🍀 trébol suerte
🌳 árbol
🌲 pino árbol
🌵 cactus
🌸 flor cerezo
🌻 girasol flor
🌹 rosa flor
🍁 hoja otoño
🍂 hojas otoño
🌍 mundo tierra planeta
🌙 luna noche
☀️ sol día
⛅ nube sol
🌧️ lluvia
❄️ nieve frío copo
🌈 arcoíris
🌊 ola mar
🔆 brillo
🐶 perro
🐱 gato
🦊 zorro
🐻 oso
🐼 panda
🐨 koala
🦁 león
🐸 rana
🐵 mono
🐔 gallina
🐧 pingüino
🦉 búho
🦋 mariposa
🐝 abeja
🐢 tortuga
🐙 pulpo
🐳 ballena
🦄 unicornio
`,
  Comida: `
🍎 manzana fruta
🍊 naranja fruta
🍋 limón
🍌 plátano
🍉 sandía
🍇 uvas
🍓 fresa
🥑 aguacate
🥕 zanahoria
🌽 maíz
🥦 brócoli verdura
🍞 pan
🧀 queso
🥚 huevo
🍳 sartén cocinar huevo
🥗 ensalada
🍕 pizza
🍔 hamburguesa
🌮 taco
🍝 pasta espaguetis
🍜 sopa ramen
🍣 sushi
🍰 tarta pastel
🎂 cumpleaños tarta
🍪 galleta
🍫 chocolate
☕ café taza
🍵 té
🍺 cerveza
🍷 vino
🥂 brindis
`,
  Actividades: `
⚽ fútbol balón
🏀 baloncesto
🎾 tenis
🏐 voleibol
🚴 bici ciclismo
🏃 correr
🧘 yoga meditar
🏋️ pesas gimnasio
🏊 nadar
⛰️ montaña
🏕️ acampada
🎨 arte pintura paleta diseño
🎭 teatro
🎬 cine película claqueta
🎤 micrófono cantar
🎵 música nota
🎸 guitarra
🎹 piano
📚 libros estudiar leer
📖 libro abierto leer
✏️ lápiz
🖊️ bolígrafo
🖌️ pincel
🎓 graduación estudios
🏫 escuela colegio
🎁 regalo
🎉 fiesta confeti
🎈 globo
`,
  Viajes: `
🏠 casa hogar
🏡 casa jardín
🏖️ playa vacaciones
🏝️ isla
🗺️ mapa
🧭 brújula
✈️ avión viaje vuelo
🚗 coche
🚕 taxi
🚌 autobús
🚆 tren
🚲 bicicleta
⛵ velero barco
🛳️ barco crucero
🏨 hotel
🗼 torre
🏰 castillo
⛪ iglesia
🎡 noria
🧳 maleta equipaje
🛫 despegue
`,
  Símbolos: `
🔴 rojo círculo
🟠 naranja círculo
🟡 amarillo círculo
🟢 verde círculo
🔵 azul círculo
🟣 morado círculo
⚫ negro círculo
⚪ blanco círculo
🟥 rojo cuadrado
🟩 verde cuadrado
🟦 azul cuadrado
➕ más sumar
➖ menos restar
➡️ derecha flecha
⬅️ izquierda flecha
⬆️ arriba flecha
⬇️ abajo flecha
🔄 repetir ciclo
♻️ reciclar
ℹ️ información
🆕 nuevo
🆗 ok
🔝 top
`,
};

export interface Emoji {
  char: string;
  words: string;
}

export const EMOJI_GROUPS: { name: string; emojis: Emoji[] }[] = Object.entries(
  DATA,
).map(([name, text]) => ({
  name,
  emojis: text
    .trim()
    .split("\n")
    .map((line) => {
      const [char, ...words] = line.trim().split(" ");
      return { char, words: words.join(" ") };
    }),
}));

const fold = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Emojis cuyo nombre contiene `query` (sin distinguir tildes). */
export function searchEmoji(query: string): Emoji[] {
  const q = fold(query.trim());
  const seen = new Set<string>();
  return EMOJI_GROUPS.flatMap((g) => g.emojis).filter((e) => {
    if (seen.has(e.char) || !fold(e.words).includes(q)) return false;
    seen.add(e.char);
    return true;
  });
}

/** Un emoji al azar de los más usados para iconos. */
export function randomIcon() {
  const pool = "📝📄📌💡🚀🎯📚🧠✨🔥🌱🎨💼📊🗂️⭐🧩🏠🌍🎉".match(/\p{Extended_Pictographic}️?/gu)!;
  return pool[Math.floor(Math.random() * pool.length)];
}
