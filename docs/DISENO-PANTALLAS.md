# Diseño de pantallas

Rediseño de las pestañas principales (todas menos Jugar), del menú de grupos, de los ajustes del grupo y de los popups.

- Lienzo con todas las pantallas: https://claude.ai/artifact/LyWLZPUr9Tki3JbXrV39Wi
- Fuentes de cada pantalla (HTML estático, se abren en el navegador): [`docs/diseno/`](diseno/)

Este documento recoge **qué ya está aplicado** y **qué falta**, con lo necesario para hacerlo cuando toque sin volver a diseñar.

## Sistema visual (ya aplicado)

Todo vive en `frontend/src/app/globals.css`; reutilízalo en lugar de inventar valores nuevos.

| Token / clase | Valor | Uso |
| --- | --- | --- |
| `--layer-1` | `#14171b` | Tarjetas y listas |
| `--layer-2` | `#1b1f24` | Menús y hojas (popups) |
| `--layer-3` | `#262b31` | Botón Cancelar, segmento activo |
| `--nav-bg` | `#0d1013` | Barra de pestañas, fondo de inputs |
| `--felt-card` | `#0f5c35` | Tarjeta de saldo, tarjeta de invitar |
| `--danger-solid` / `--danger-soft` | `#e5484d` / `#ff8a8a` | Confirmar algo irreversible / texto rojo |
| `--radius` | 20px | Tarjetas |
| `.label` | Mayúsculas, 0,75 rem, gris | Título de sección encima de una lista |
| `.btn-outline`, `.btn-danger`, `.btn-destructive` | — | Secundario con borde, rojo con borde, rojo sólido |
| `.switch` | 48×28, `role="switch"` + `aria-checked` | Interruptores de ajustes |
| `Avatar` (`ui/Avatar.tsx`) | Inicial sobre color estable por id | Cualquier jugador |
| `ConfirmSheet` (`ui/ConfirmSheet.tsx`) | Hoja inferior con icono, título, texto y dos botones | Sustituye a `window.confirm` |

Tipografía: Manrope para todo; Fraunces cursiva 600 (`--font-felt`) solo para cifras grandes de saldo y puestos del podio.

Patrón de listas agrupadas (Ajustes, Perfil, Miembros): `.label` encima + `.list` con filas `.listRow` de 56 px, texto en `.listText` (con `<small>` como subtítulo) y `ChevronRightIcon` a la derecha si navega.

## Ya aplicado

- **Barra de pestañas**: Jugar es una ficha de casino de 52 px con el icono de cartas dentro.
- **Barra superior**: píldora del grupo y de monedas sobre `--layer-1`.
- **Menú de grupos**: lista con iniciales, posición, «Vas primero», crear/unirse y enlace a los ajustes.
- **Inicio**: tarjeta de saldo verde con puesto y cuenta atrás; Top 3 de la semana; Ver ranking / Invitar.
- **Ranking**: podio 2-1-3 con corona, resto de la clasificación en lista, «A cero · vuelve mañana con la paga», aviso de cierre y cuánto falta para alcanzar al de arriba.
- **Perfil**: cabecera con avatar, estadísticas 2×2 (valores «—» hasta que haya datos de manos), Logros (vacío), Estilos (Próximamente) y Ajustes.
- **Ajustes**: Cuenta (editar nombre en línea), General (idioma, ajustes del grupo) y Cerrar sesión.
- **Ajustes del grupo**: tarjeta verde de invitar (compartir enlace, copiar, renovar), nombre del grupo, ocultar ranking con interruptor, miembros con expulsar, salir del grupo.
- **Popups**: renovar código, expulsar, salir del grupo (hojas `ConfirmSheet`) y el aviso de instalar la app.

## Pendiente

Ordenado más o menos por cuándo tendrá sentido (casi todo depende de que se guarden las manos jugadas, fase 3).

### Inicio (`Main.dc.html`)

1. **Retos de hoy** — tarjeta con contador «1 de 3» y tres filas: icono, texto del reto («Gana 3 manos seguidas»), barra de progreso fina y la recompensa en dorado con la moneda (`+150 🪙`). La recompensa son **monedas** para estilos, no fichas: al completarse la fila se marca con `CheckIcon`, se suman a la píldora de monedas de arriba y no cambian el saldo de la liga. Necesita: tabla de retos diarios y progreso por jugador en el backend.
2. **Baraja del día** — tarjeta con un naipe con el número (`#42`), título «Baraja del día #42» y subtítulo «Las mismas cartas para todos · 1 intento»; toda la tarjeta es un enlace a jugarla. Necesita: semilla diaria compartida en el motor y un intento por jugador y día.
3. **Lo último** — lista corta (2 filas) con avatar, «**Luis** ganó 4.000 con un blackjack» y hora relativa («· 12 min»); enlace «Ver todo» a Social. Sale del mismo feed que Social.

### Ranking (`Ranking.dc.html`)

1. **Selector Semana / Historial / Baraja del día** — `.segmented` bajo el título.
   - *Historial*: semanas cerradas con el ganador de cada una y tu puesto.
   - *Baraja del día*: clasificación del intento diario.
2. **Movimiento en la lista** — cada fila muestra a la derecha cuántos puestos ha subido o bajado (`RankChange` ya lo pinta; falta pasarle el dato en el ranking completo).

### Social (`SocialFeed.dc.html`, `SocialChat.dc.html`)

Ahora mismo es un estado vacío. El diseño tiene un `.segmented` **Feed / Chat** (el chat con contador de no leídos).

- **Feed**: agrupado por día («Hoy», «Ayer»). Cada evento: avatar, frase con el nombre en negrita y la cifra en dorado, hora relativa y reacciones (emoji + número). Tipos: ganó con blackjack, te ha adelantado, se ha quedado a cero, completó un reto, resultado de la Baraja del día (tarjeta especial con «Ver clasificación»).
- **Chat**: cabecera con «N conectados», burbujas propias a la derecha en dorado y ajenas a la izquierda en `--layer-1` con avatar, mensajes del sistema centrados en gris («Pablo se ha quedado a cero»), «Carlos está escribiendo…» y caja de mensaje fija encima de la barra de pestañas.
- Necesita: eventos en el backend, tiempo real (SSE o WebSocket) y moderación mínima.

### Perfil (`Perfil.dc.html`)

1. **Subtítulo** «@marta · desde marzo» (fecha de alta).
2. **Racha** — píldora dorada «Racha de 6 días» bajo el nombre (días seguidos jugando).
3. **Estadísticas reales** — Manos jugadas, Manos ganadas (%), Blackjacks y Mejor mano (mayor ganancia en una mano).
4. **Semanas ganadas** — tarjeta con un gráfico de 8 barras (últimas 8 semanas, la barra en dorado si ganaste) y la frase «2 semanas ganadas. Esta vas 2º.»
5. **Logros** — rejilla de 4 columnas con medallas (conseguidas en color, el resto apagadas) y contador «9 de 24». Ejemplos: Primer blackjack, Campeona semanal, Racha de 5, Doble o nada.
6. **Filas nuevas** en la lista: Mis grupos (con número a la derecha) e Historial de manos.

### Ajustes (`Ajustes.dc.html`)

1. **Cambiar contraseña** — fila en Cuenta que abre un formulario (actual, nueva, repetir).
2. **Partida** — interruptores Sonido, Vibración y «Pedir confirmación al doblar» (subtítulo «Evita doblar sin querer»), y `.segmented` Velocidad del crupier: Tranquila / Normal / Rápida. Se guardan en el perfil.
3. **Avisos** — interruptores Paga diaria lista, Me adelantan en el ranking, Mensajes del chat. Necesita notificaciones push de la PWA.
4. **Cómo se juega** — fila en General que abre las reglas.
5. **Pie** — «Blackjack with Friends · versión a20464d» centrado y en gris, con el commit de la imagen.
