# Blackjack with Friends: documento de diseño

> Estado: **v2, decisiones confirmadas**. Los valores marcados con 🔧 son propuestas que no se han confirmado expresamente y se pueden ajustar durante la beta.

## 1. Concepto

Una **liga semanal de blackjack entre amigos**. Cada jugador juega **solo contra la banca**, a su ritmo, cuando quiera. Lo que se comparte es la competición:

- Cada jugador tiene **un único saldo de fichas**, el mismo en todos sus grupos. Juegas una sola vez y cuenta para todos.
- Los **grupos son clasificaciones**: cada grupo de amigos ordena a sus miembros por ese saldo. Puedes estar en varios grupos y en cada uno ocupas el puesto que te toque.
- Cada día recibes una **paga diaria** de fichas que se suma a tu saldo.
- El **domingo a medianoche** se cierra la semana: en cada grupo gana quien tenga **más fichas**. Hay ceremonia con podio, premios de broma y trofeo para el ganador.
- El lunes empieza un **ciclo nuevo** para todos a la vez: todos vuelven al saldo inicial y las estadísticas quedan guardadas.
- Extras: **Baraja del día** (todo el grupo juega las mismas cartas, estilo Wordle) y **retos y logros**.
- Lo social: feed de actividad, reacciones, chat de grupo y notificaciones push.
- Progresión permanente: **monedas** (distintas de las fichas) para desbloquear **estilos** de tapete, cartas, etc.

### Dos monedas, dos propósitos

| | **Fichas** 🟢 | **Monedas** 🪙 |
|---|---|---|
| Para qué | Apostar y competir en la liga | Comprar cosméticos en la tienda |
| Ámbito | Por usuario (uno solo, común a todos sus grupos) | Por usuario (global) |
| Duración | Se reinician cada semana | Permanentes |
| Cómo se ganan | Paga diaria, ganar manos | Quedar en el podio semanal, retos diarios, logros |

Separarlas es clave: gastar en la tienda **nunca** te baja en el ranking.

---

## 2. Reglas del juego

### Blackjack (reglas completas)
- 🔧 6 barajas, **barajado nuevo en cada mano** (equivale a una barajadora continua: no se pueden contar cartas).
- La banca **se planta en 17 suave** (S17).
- Blackjack paga **3:2**.
- **Doblar** solo con 9, 10 u 11 en las dos primeras cartas (`doubleOn` en `packages/engine/src/rules.ts`), también después de dividir.
- **Dividir** hasta 3 veces (4 manos). Los ases divididos reciben una sola carta.
- **Seguro** cuando la banca muestra un As (paga 2:1).
- **Rendirse** (tardío): recuperas la mitad de la apuesta.
- Sin límite de tiempo: si cierras la app a mitad de mano, la retomas donde la dejaste.

### Economía de la liga
- Todo esto lo fija **el servidor** y es igual para todos: ningún admin de grupo puede cambiar el saldo inicial, la paga ni el reinicio semanal.
- Saldo inicial cada lunes: **1.000 fichas**.
- Paga diaria: **+1.000 fichas**, se cobra con un botón (no caduca dentro de la semana: si no entras el martes, el miércoles cobras 2).
- 🔧 Apuesta mínima **10** y máxima **500** por mano, para que una sola mano no decida la semana (doblar y separar sí pueden pasar de 500).
- Si te quedas a 0, esperas a la paga del día siguiente.
- Cierre de semana: **domingo 23:59, hora de Madrid**.
- **Quien empieza a jugar a mitad de semana** recibe el saldo inicial más **todas las pagas de los días ya transcurridos** (incluido el de hoy). Empieza con lo mismo que habría tenido alguien que empezó el lunes y no jugó.
- Unirte a un grupo (o salir de él) no cambia tu saldo: solo apareces o dejas de aparecer en su clasificación.

### Premios semanales (monedas)
- 1º: **100** 🪙 + trofeo · 2º: **60** 🪙 · 3º: **30** 🪙 · Haber jugado al menos 1 día: **10** 🪙.
- **Solo cobras por tu mejor puesto**: si estás en varios grupos, recibes el premio del grupo donde mejor has quedado, no la suma. El de haber jugado se cobra una vez.
- **Un grupo solo reparte premios si tiene al menos 2 personas** que hayan jugado esa semana 🔧 (que hayan jugado, para que un amigo que nunca entra no cuente). Así no sirve de nada crear grupos vacíos para ser 1º. La ceremonia y los premios de broma se ven igual en cualquier grupo.
- Premios de broma (solo para presumir, sin monedas): más blackjacks, apuesta más loca, peor racha, más manos jugadas, "rey del seguro"...

### Baraja del día
- Todos los jugadores juegan **las mismas cartas** ese día (una sola semilla para todos), así que tu partida cuenta en todos tus grupos.
- **10 manos**, saldo virtual de 1.000 aparte de la liga y la misma apuesta fija de 100 por mano, para que solo cuenten las decisiones.
- Clasificación diaria propia en cada grupo. Premio para el 1º del día: **+500 fichas** en tu saldo, como mucho una vez al día aunque seas 1º en varios grupos, y solo en grupos donde hayan jugado la baraja al menos 2 personas.
- Al terminar, puedes compartir el resultado en el grupo, estilo Wordle: `🃏 Baraja del día #42 · +650 · 🟩🟩🟥🟩⬜🟩🟥🟩🟩🟩`.
- Hasta que acabas tus 10 manos no ves las de los demás, para que nadie te haga spoiler.

### Retos y logros
- **Retos diarios**: 3 al día, iguales para todos los jugadores (p. ej. "gana 3 manos seguidas", "haz un split ganador", "gana con 5 cartas"). Cada uno da 🪙 **monedas** (no fichas) para gastar en estilos: son un logro personal, así que no cuentan para la liga ni mueven el ranking. La cantidad se ajusta en la beta.
- **Logros** permanentes con insignia en el perfil y algunos con cosmético o monedas de premio (p. ej. "Primer blackjack", "Gana una semana", "10 semanas en el podio", "Sobrevive con 1 ficha").

---

## 3. Arquitectura

### Decisión principal: el servidor reparte las cartas
El navegador **nunca** decide las cartas ni calcula premios. Solo envía acciones ("pedir", "plantarse"...) y muestra lo que el servidor responde. Así nadie puede hacer trampas tocando el código del navegador.

### Componentes

```mermaid
flowchart LR
  subgraph Box["🐳 Contenedor único (Docker / ZimaOS)"]
    UI[PWA Next.js + React + TS<br/>interfaz y animaciones]
    SW[Service worker<br/>caché + autoupdate + push]
    RW[Next.js :3000<br/>rewrites /api/* → API]
    API[API Node :3001 interna<br/>lógica de juego]
    OG[Vistas previas de enlaces<br/>+ imágenes OG]
    DB[(SQLite en /data<br/>+ Drizzle)]
    Cron[Tareas programadas<br/>dentro de la API]
  end

  Engine[[packages/engine<br/>motor compartido]]

  Push[Servicios push<br/>Apple / Google]
  Bots[Bots de vista previa<br/>WhatsApp, Discord,<br/>Telegram, iMessage...]

  Engine -. usado por .-> UI
  Engine -. usado por .-> API
  Bots -- /i/código --> RW
  UI -- acciones de juego --> RW
  RW --> API
  RW --> OG
  OG -- datos públicos de la invitación --> DB
  API -- Better Auth: sesiones y datos --> DB
  Cron --> API
  API -- Web Push --> Push --> SW
```

### Tecnologías

| Pieza | Elección | Por qué |
|---|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript | Rutas por carpetas, metadatos y vistas previas de enlaces en el propio frontend |
| Rutas | App Router de Next.js | La app es cliente tras el login; el servidor solo sirve HTML, metadatos e imágenes OG |
| Datos del servidor | TanStack Query contra nuestra `/api` | Caché, reintentos y refresco periódico (en vez de tiempo real) |
| Animaciones | Motion (antes Framer Motion) | Cartas volando, fichas, podio |
| Sonido | Howler.js | Fiable en iOS y fácil de silenciar |
| Idiomas | i18next (es + en) | Desde el día 1 |
| Backend (API) | Servidor Node/TypeScript en `backend/` (`server.ts`), solo accesible desde dentro del contenedor | La lógica de juego; Next le pasa `/api/*` |
| Base de datos | SQLite (better-sqlite3) + Drizzle ORM, un fichero en el volumen `/data` | Sin servicios aparte; migraciones en el repo, aplicadas al arrancar la API. Un solo proceso escribe, así que las transacciones son simples |
| Login | Better Auth con usuario y contraseña (sin correos) | Librería, no servicio: usuarios y sesiones en nuestra BD, cookie en nuestro dominio. El nombre de usuario es el nombre en la liga |
| Tareas programadas | Temporizador dentro de la API (o perezosas, al primer uso) | Sin servicios extra |
| Avatares | Generados (inicial y color); fotos más adelante, guardadas en `/data` | Nada que alojar al principio |
| Hosting | Una imagen Docker todo en uno (`ghcr.io/ronambulo/blackjackwithfriends`): supervisord arranca la API y Next; se instala en ZimaOS con `docker-compose.yml` | Como FinanceMaster y Beergram. Solo se publica el puerto de Next, así que no hay CORS. Para la PWA hace falta HTTPS: proxy inverso o túnel delante |
| Vistas previas de enlaces | `generateMetadata` + `opengraph-image` de Next.js (`next/og`) | El HTML de cada invitación ya sale del servidor con sus metadatos e imagen |
| Códigos QR | Librería `qrcode`, generada en el navegador | Sin servidor y funciona sin conexión |
| Push | Web Push con claves VAPID desde el backend | En iPhone solo funciona con la app instalada (iOS 16.4+) |
| Tests | Vitest | Sobre todo para el motor de blackjack |

### Motor de blackjack compartido
Un único paquete TypeScript **puro**, sin dependencias, en `packages/engine/` (`@bwf/engine`). Lo usan:
- el **backend**, que es la autoridad: reparte, valida acciones y calcula pagos;
- el **cliente**, solo para mostrar (valor de la mano, qué botones están activos).

Se prueba a fondo con tests unitarios: todas las reglas y casos raros.

### Estado de una mano (máquina de estados)

```mermaid
stateDiagram-v2
  [*] --> Apostando
  Apostando --> Repartiendo: apostar (el servidor descuenta fichas)
  Repartiendo --> Seguro: banca muestra As
  Repartiendo --> Resuelta: blackjack natural (jugador o banca)
  Repartiendo --> TurnoJugador
  Seguro --> Resuelta: banca tenía blackjack
  Seguro --> TurnoJugador: banca no tenía blackjack
  TurnoJugador --> TurnoJugador: pedir / dividir / doblar (siguiente mano dividida)
  TurnoJugador --> Resuelta: rendirse / todas las manos pasadas de 21
  TurnoJugador --> TurnoBanca: plantarse en todas las manos
  TurnoBanca --> Resuelta: banca pide hasta 17+
  Resuelta --> [*]: pagar, actualizar estadísticas, retos y feed
```

Cada mano se guarda en la base de datos en cada paso. Si se recarga la app (por ejemplo, por una actualización automática), la mano sigue exactamente donde estaba.

### Flujo de una acción de juego

```mermaid
sequenceDiagram
  participant J as Jugador (PWA)
  participant F as Backend POST /api/play
  participant DB as SQLite

  J->>F: { handId, acción: "pedir" } + token de sesión
  F->>DB: abre una transacción (un solo proceso escribe: nada se cuela en medio)
  F->>F: valida que la acción es legal
  F->>F: motor aplica la acción, saca carta del mazo guardado
  alt la mano termina
    F->>DB: guarda resultado, actualiza saldo,<br/>estadísticas, retos, logros
    F->>DB: inserta evento en el feed (si es destacable)
  else sigue
    F->>DB: guarda estado
  end
  F-->>J: estado visible (sin la carta tapada de la banca ni el mazo)
  Note over J,DB: los demás ven el ranking nuevo en su siguiente refresco (cada pocos segundos)
```

El mazo de cada mano se guarda en el servidor y **nunca se envía al cliente**. La carta tapada de la banca solo se envía cuando se descubre.

### Tareas programadas

| Cuándo | Qué |
|---|---|
| Cada hora | Comprueba si en Madrid ya es lunes 00:00 para cerrar las semanas. Se ejecuta cada hora para no depender del cambio de horario. |
| Cierre de semana | Congela la clasificación de cada grupo, calcula podios y premios de broma, da a cada jugador las monedas de su mejor puesto y los trofeos, archiva las estadísticas, reinicia los saldos y crea la nueva temporada (una para todos). |
| Diario 00:00 Madrid | Genera la semilla de la Baraja del día y los 3 retos diarios (los mismos para todos). |
| Domingo 21:00 | Push: "Quedan 3 horas para el cierre de la liga". |

La paga diaria **no** usa cron: se calcula al cobrarla, según los días que han pasado. Es más sencillo y no falla si el cron se retrasa.

---

## 4. Modelo de datos

```mermaid
erDiagram
  profiles ||--o{ group_members : "pertenece"
  groups ||--o{ group_members : "tiene"
  seasons ||--o{ season_results : "resultado de cada jugador"
  seasons ||--o{ season_standings : "puesto en cada grupo"
  groups ||--o{ season_standings : ""
  profiles ||--o{ hands : "juega"
  seasons ||--o{ hands : "en"
  groups ||--o{ feed_events : "actividad"
  feed_events ||--o{ reactions : ""
  groups ||--o{ messages : "chat"
  profiles ||--o{ daily_deck_runs : "partidas"
  daily_decks ||--o{ daily_deck_runs : "partidas"
  profiles ||--o{ user_achievements : ""
  achievements ||--o{ user_achievements : ""
  profiles ||--o{ user_cosmetics : "colección"
  cosmetics ||--o{ user_cosmetics : ""
  profiles ||--o{ push_subscriptions : ""

  profiles {
    uuid id PK
    text nombre
    text avatar_url
    text idioma
    int monedas
    bigint saldo "fichas de la liga, una sola para todos los grupos"
    date semana "lunes de la semana a la que pertenece el saldo"
    date ultima_paga
    bigint saldo_inicio_dia "para el +/- de hoy y las flechas del ranking"
    date dia
    jsonb estilos_equipados
  }
  groups {
    uuid id PK
    text nombre
    text codigo_invitacion "10 caracteres, renovable"
    jsonb ajustes "ocultar ranking en la vista previa..."
  }
  group_members {
    uuid group_id PK
    uuid user_id PK
    text rol "admin | miembro"
  }
  seasons {
    uuid id PK
    date semana_inicio
    text estado "activa | cerrada"
  }
  season_results {
    uuid season_id PK
    uuid user_id PK
    bigint saldo_final
    jsonb estadisticas
    int monedas_ganadas "las de su mejor puesto"
  }
  season_standings {
    uuid season_id PK
    uuid group_id PK
    uuid user_id PK
    int posicion
    jsonb premios "trofeo y premios de broma de ese grupo"
  }
  hands {
    uuid id PK
    uuid user_id
    uuid season_id
    text modo "prueba | liga | baraja_del_dia"
    bigint apuesta
    jsonb ronda "estado completo con el mazo, solo servidor"
    text fase "insurance | player | settled"
    int version
    bigint neto
  }
  cosmetics {
    text id PK
    text tipo "tapete | cartas | dorso | fichas | marco_avatar"
    text origen "gratis | logro | trofeo | tienda"
    int precio_monedas
  }
```

Notas:
- **Manos**: `ronda` guarda el estado entero del motor (mazo incluido) y nunca sale tal cual del servidor; al cliente solo le llega la vista pública. `version` evita que dos acciones a la vez se apliquen sobre la misma mano, y un índice único impide tener más de una mano abierta por jugador y modo. Se juega siempre con el saldo de la liga (`profiles.saldo`).
- **Saldo único**: el saldo y la paga viven en `profiles`, no en el grupo. El cambio de semana y de día se aplica **al vuelo**: cada petición que lee o toca el saldo comprueba `semana` y `dia`, y si son viejos devuelve el saldo a 1.000 o guarda el saldo de inicio del día. La paga no se ingresa sola: se acumula día a día y se cobra con un botón (pagas pendientes = hoy − `ultima_paga`, o desde el día antes del lunes si aún no ha cobrado ninguna esta semana). Las temporadas (`seasons`, `season_standings`, `season_results`) llegan en la fase 5.
- **Grupos**: el admin está en `group_members.rol`, no en `groups`, así que puede haber traspaso sin tocar el grupo: si el admin se va, pasa a serlo el miembro más antiguo, y un grupo que se queda vacío se borra. Como mucho 10 grupos por jugador y 50 miembros por grupo. La clasificación usa el ranking de competición (1, 2, 2, 4). La clasificación de un grupo es una consulta de los saldos de sus miembros; al cerrar la semana se congela en `season_standings`, y `season_results` guarda lo de cada jugador una sola vez (saldo final y monedas de su mejor puesto).
- **Solo el backend toca la base de datos**: la app nunca se conecta a ella. Cada ruta de la API comprueba la sesión y que eres miembro del grupo, así que solo ves los datos de tus grupos. Los saldos, manos y monedas **solo** los cambia el backend.
- El campo `cosmetics.origen` deja la puerta abierta a añadir más adelante un origen "compra" sin cambiar nada más. **No hay ninguna huella visible de esto en la app.**

---

## 5. Flujos de usuario

### Primera vez: invitación → jugando

```mermaid
flowchart TD
  A0[Admin: Invitar → enlace o QR] --> A1[Lo pega en WhatsApp / Discord<br/>→ se ve la tarjeta con vista previa]
  A0 --> A2[Lo enseña en persona<br/>→ el amigo escanea el QR con la cámara]
  A1 --> A[Amigo abre<br/>…/i/K7mQ2xP9aR]
  A2 --> A
  A --> B{¿Tiene sesión?}
  B -- No --> C[Pantalla de invitación<br/>'Luis te invita a Los del Curro'<br/>miembros, ranking actual]
  C --> D[Crear cuenta o entrar<br/>usuario y contraseña]
  B -- Sí --> F
  D --> F[Unirse al grupo]
  F --> G[Aparece en el ranking con su saldo de siempre]
  G --> H[Aviso de instalar la PWA]
  H --> I[Inicio del grupo]
```

Unirse a un grupo no da ni quita fichas: el saldo es el mismo en todos los grupos. Quien empieza a jugar a mitad de semana arranca con el saldo inicial más las pagas de los días ya transcurridos (ver [Economía de la liga](#economía-de-la-liga)).

### Bucle diario

```mermaid
flowchart LR
  N[🔔 Push: paga lista] --> O[Abrir app]
  O --> P[Inicio: cobrar paga<br/>+ animación de fichas]
  P --> Q[Ver retos del día<br/>y feed]
  Q --> R{¿Qué jugar?}
  R --> S[Baraja del día<br/>10 manos]
  R --> T[Mesa de la liga]
  S --> U[Compartir resultado]
  T --> V[Feed: grandes ganancias,<br/>adelantamientos, ruinas]
  V --> W[Reacciones y chat]
  U --> W
```

### Cierre semanal

```mermaid
sequenceDiagram
  participant C as Temporizador de la API
  participant DB as SQLite
  participant P as Push
  participant J as Jugador

  C->>DB: lunes 00:00 Madrid → cerrar temporada
  DB->>DB: congelar clasificación, calcular premios,<br/>dar monedas y trofeos, archivar estadísticas
  DB->>DB: nueva temporada, saldos al inicial
  C->>P: "🏆 ¡Ana gana la semana! Mira el podio"
  J->>J: abre la app
  J->>J: ceremonia: podio animado → premios de broma<br/>→ tus monedas → "nueva semana"
```

---

## 6. Diseño UI / UX

### Principios
- **Móvil primero, en vertical**, y usable con una mano: las acciones principales quedan en el tercio inferior.
- **Estilo base moderno oscuro**: fondo casi negro, superficies con un ligero efecto de cristal, un color de acento y tipografía limpia. Es neutro para que cualquier tapete elegido quede bien.
- **Mucho "juice"**: cartas que vuelan desde el mazo, fichas que se apilan y saltan al ganar, confeti en los blackjacks, números que cuentan hacia arriba, sonidos y vibración. Todo se puede silenciar en Ajustes.
  - En iPhone, el navegador no permite vibrar desde una web; solo vibra en Android.
- Respetar "reducir movimiento" del sistema: si está activado, las animaciones se acortan.
- Español e inglés desde el inicio.

### Navegación

Barra inferior con 5 pestañas. El botón central **Jugar** es más grande. Arriba, un **selector de grupo** si perteneces a varios.

```
┌─────────────────────────────┐
│ Los del Curro ▾      🪙 240 │  ← selector de grupo · monedas
│                             │
│          (pantalla)         │
│                             │
├─────────────────────────────┤
│  🏠    👥    (🃏)    💬   👤 │
│ Inicio Grupos Jugar Social Perfil 
└─────────────────────────────┘
```

### Pantallas

**Inicio (resumen del grupo)**
```
┌─────────────────────────────┐
│ Los del Curro ▾      🪙 240 │
│ ┌─────────────────────────┐ │
│ │ Tu saldo      12.450 🟢 │ │
│ │ 2º de 6  ▲1   ⏱ 2d 14h  │ │
│ │ [ 💰 Cobrar paga +1.000 ]│ │
│ └─────────────────────────┘ │
│ Top 3: 🥇 Ana 15.200        │
│        🥈 Tú  12.450        │
│        🥉 Luis 9.800        │
│ ┌ Retos de hoy ───── 1/3 ┐ │
│ │ ✅ Gana 3 seguidas      │ │
│ │ ⬜ Split ganador  +200  │ │
│ └─────────────────────────┘ │
│ [🃏 Baraja del día #42  ▶ ] │
│ Feed ─────────────────────  │
│ Luis ganó 4.000 con BJ 🔥3  │
│ Marta se arruinó 💀5        │
├─────────────────────────────┤
│  🏠    👥    (🃏)    💬   👤 │
└─────────────────────────────┘
```

**Mesa**: el tapete, las cartas, el dorso y las fichas cambian con los estilos elegidos.
```
┌─────────────────────────────┐
│ ←  Liga       12.450 🟢  🔊 │
│                             │
│       BANCA   [🂠][K♥]      │
│                             │
│      ░░░ tapete ░░░         │
│                             │
│    [A♠][7♦]   = 18 / 8      │
│      apuesta: 500           │
│                             │
│ [Rendirse] [Seguro]         │
│ [ Pedir ] [Plantarse]       │
│ [ Doblar ] [ Dividir ]      │
└─────────────────────────────┘
```
Al apostar, se toca sobre fichas de 10 / 50 / 100 / 500 / 1.000. También hay botones de "repetir apuesta", "x2" y "all-in".

**Grupos**: una tarjeta por grupo con tu puesto, la variación del día (▲▼) y quién va primero, más los botones de crear y unirse. Al tocar una tarjeta se abre el grupo (`/grupos/[id]`): el botón **Invitar amigos** (enlace, código y QR, en `/grupos/[id]/invitar`), la clasificación en vivo, la lista de miembros, los ajustes si eres admin y salir del grupo. Más adelante, el historial de semanas pasadas y la clasificación de la Baraja del día.

**Social**: dos subpestañas, **Feed** (con reacciones) y **Chat** del grupo.

**Perfil**:
- Estadísticas de esta semana o de siempre: resultado, reparto de manos ganadas / empatadas / perdidas, neto global, manos jugadas, blackjacks, mayor ganancia, mejor racha y una gráfica de las últimas 30 manos. Se calculan a partir de las manos guardadas (`GET /api/profile/stats`). Más adelante, semanas ganadas.
- Vitrina de trofeos y logros.
- Acceso a **Estilos**.

**Estilos y tienda**: una cuadrícula por tipo (tapete, cartas, dorso, fichas, marco de avatar). Cada elemento está equipado, disponible o bloqueado; si está bloqueado, se indica cómo conseguirlo ("Gana una semana" o "150 🪙").

**Ceremonia semanal**: a pantalla completa y en secuencia: redoble → 3º → 2º → 1º con confeti → premios de broma → "has ganado X 🪙" → "¡Nueva semana!".

**Ajustes**: idioma, sonido, vibración, notificaciones (por tipo) y cerrar sesión. Si eres admin, también los ajustes del grupo: expulsar miembros, ocultar el ranking en la vista previa y renovar el enlace de invitación. La paga, el saldo inicial y el reinicio semanal los fija el servidor y no se pueden cambiar por grupo.

### Cosméticos iniciales (propuesta)
- **Gratis** (los "pochos"): tapete verde básico, cartas clásicas y dorso rojo.
- **Logros**: p. ej. tapete "Medianoche" por 100 blackjacks, o dorso "Kamikaze" por ganar un all-in.
- **Trofeos**: tapete dorado "Campeón" al ganar 1 semana, o marco de avatar con laurel al ganar 5.
- **Tienda** (🪙): unos 15 estilos variados, como neón, madera, pixel-art, minimalista o retro.

---

## 7. Lado social

| Función | Detalle |
|---|---|
| Grupos | El creador es admin. Se entra por enlace de invitación (renovable). Puedes estar en varios grupos; tu saldo es el mismo en todos y cada grupo es una clasificación. |
| Feed | Eventos automáticos destacables: blackjack con apuesta alta, ganancia o pérdida grande, adelantamiento en el ranking, ruina, reto o logro completado, resultado de la Baraja del día. |
| Reacciones | 🔥 😂 💀 👏 😱 en cada evento del feed. |
| Chat | Texto y emojis; se refresca cada pocos segundos mientras está abierto. Se pueden citar eventos del feed. |
| Push | Paga lista (si no has cobrado a las 🔧 18:00), te han adelantado, mención en el chat, quedan 3 h de liga y ceremonia lista. Cada tipo se activa o desactiva por separado. |
| Compartir fuera | Resultado de la Baraja del día y podio semanal como texto o imagen para WhatsApp. |

Moderación mínima: el admin puede expulsar miembros y cualquiera puede borrar sus propios mensajes.

### Invitar: enlace con vista previa y QR

**Pantalla "Invitar"** (desde el Inicio del grupo o desde sus ajustes):
```
┌─────────────────────────────┐
│ ←  Invitar a Los del Curro  │
│                             │
│      ┌───────────────┐      │
│      │ ▀▄█▀▄ ▄▀█▄▀▄  │      │
│      │ █▄▀ [🃏] ▀▄█  │      │  ← QR con el icono de la app en el centro
│      │ ▄▀█▄▀▄ █▀▄▀█  │      │
│      └───────────────┘      │
│   Escanéalo con la cámara   │
│                             │
│ …/i/K7mQ2xP9aR    │
│ [ 📤 Compartir ] [ 📋 Copiar]│
│ [ ⬇️ Guardar QR como imagen ]│
│                             │
│ Admin: [ 🔄 Renovar enlace ] │
└─────────────────────────────┘
```
- **Compartir** abre el menú nativo del móvil (WhatsApp, Telegram...). Si no está disponible, copia el enlace.
- El **QR** se genera en el propio navegador con el estilo oscuro de la app y el icono en el centro. Se puede guardar como imagen.
- Para escanearlo no hace falta lector dentro de la app: basta la cámara del móvil, que abre el enlace.
- **Renovar enlace** invalida el anterior (y su QR). Sirve si se ha filtrado.
- Si quien abre el enlace no tiene cuenta, primero se registra (o inicia sesión) y elige nombre. La invitación se guarda en el dispositivo durante 24 h y, al entrar, la app le lleva directamente a la pantalla de unirse a ese grupo.

**Vista previa del enlace** (la tarjeta que aparece al pegarlo en WhatsApp, Discord, Telegram, iMessage, X...):

```
┌──────────────────────────────────────────┐
│ Blackjack with Friends                    │
│ Luis te invita a «Los del Curro» 🃏        │  ← og:title
│ 6 jugadores · Semana 12 · Líder: Ana       │  ← og:description
│ ┌──────────────────────────────────────┐ │
│ │  [tapete verde]                       │ │
│ │   LOS DEL CURRO                       │ │  ← og:image 1200×630
│ │   (avatares de los miembros)          │ │     generada al vuelo
│ │   🥇 Ana 15.200 🥈 Pablo 12.450 🥉 …   │ │
│ │   ¡Únete a la liga!         🃏 logo    │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

Cómo funciona:
- Los bots que generan la vista previa **no ejecutan JavaScript**: solo leen las etiquetas `<meta>` del HTML que devuelve el servidor.
- Por eso, las rutas que se comparten (`/i/[código]`) son páginas de Next.js renderizadas en el servidor, fuera del grupo `(app)` que exige login:
  1. Pide al backend los datos públicos de la invitación (nombre del grupo, quién invita, número de miembros y top 3) mediante una función de solo lectura que no expone nada más.
  2. `generateMetadata` rellena las etiquetas Open Graph y de Twitter. Para una persona, la app carga con normalidad. Para un bot, la tarjeta queda bonita.
  3. `og:image` sale de `opengraph-image.tsx` en esa misma ruta, que dibuja la imagen 1200×630 con `next/og`.
- En Discord, el color de la barra lateral de la tarjeta sale de `theme-color`.
- La URL de la imagen tiene que ser absoluta: se construye con `SITE_URL` o, si no está, con `BETTER_AUTH_URL` (el dominio público).
- Las respuestas se guardan en caché unos minutos, para no consultar la BD cada vez que alguien pega el enlace.
- **Página principal y enlaces genéricos**: tarjeta estática con el logo y "Tu liga semanal de blackjack con amigos".
- **Otros enlaces compartibles** que reutilizan el mismo sistema: el resultado de la Baraja del día (`/r/…`) y el podio semanal (`/p/…`), cada uno con su imagen generada.

Privacidad y seguridad:
- Cualquiera con el enlace ve en la vista previa el nombre del grupo, los nombres del top 3 y el número de miembros. Por eso:
  - el código es **largo y aleatorio** (10 caracteres), para que no se pueda adivinar;
  - el admin puede **renovarlo**;
  - 🔧 hay un ajuste de grupo para **ocultar el ranking en la vista previa** (solo nombre del grupo y número de miembros).
- Si el código no existe o se ha renovado, la tarjeta es la genérica y la página dice "Invitación caducada, pídele otra a tu amigo".

---

## 8. Fases de desarrollo

Cada fase termina con algo usable y desplegado.

| # | Fase | Resultado |
|---|---|---|
| 0 | ✅ PWA base | Instalación con aviso y botón, y actualización automática |
| 1 | ✅ Fundaciones | Base de datos + Drizzle; login con usuario y contraseña (Better Auth); i18n; estilo base oscuro; navegación con pestañas; despliegue; tarjeta de vista previa estática para la página principal |
| 2 | ✅ Motor de blackjack | Módulo puro con todas las reglas y una batería completa de tests |
| 3 | ✅ Mesa jugable | endpoint `POST /api/play` del backend, manos guardadas en BD y mesa con animaciones básicas, todavía con un saldo de prueba |
| 4 | ✅ Grupos y liga | Saldo único de liga y paga diaria; crear grupo, unirse, ranking en vivo de cada grupo y admin |
| 4b | ✅ Invitaciones | Pantalla "Invitar" con compartir, copiar y **QR**; **vista previa del enlace** con imagen generada (`next/og`); renovar el enlace |
| 5 | Ciclo semanal | Cierre automático, ceremonia, estadísticas, trofeos y monedas |
| 6 | Social | Feed, reacciones y chat |
| 7 | Notificaciones push | Suscripción, preferencias y envíos |
| 8 | Retos y logros | Retos diarios y logros con insignias; lo que se gana con ellos son monedas para estilos, nunca fichas |
| 9 | Baraja del día | Semilla diaria, 10 manos, clasificación y compartir (con su vista previa `/r/…`) |
| 10 | Estilos y tienda | Sistema de temas para la mesa, colección, tienda y selector |
| 11 | Juice y pulido | Sonidos, más animaciones, vibración, accesibilidad y rendimiento |
| 12 | Beta con amigos | Probar con un grupo real, ajustar la economía y corregir errores |

Para empezar a probar con amigos de verdad bastan las fases 1–5 (incluida la 4b). El resto se va añadiendo semana a semana sin que nadie tenga que reinstalar nada.

---

## 9. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Saldo inicial semanal / paga diaria | 1.000 / 1.000 fichas |
| Apuesta mínima / máxima | 10 / 500 fichas por mano |
| Quien entra a mitad de semana | Saldo inicial + todas las pagas de los días ya transcurridos |
| Cierre de semana | Domingo 23:59, hora de Madrid |
| Baraja del día | 10 manos con apuesta fija; el 1º del día gana +500 fichas en la liga |
| Saldo | Uno por jugador, común a todos sus grupos; los grupos son clasificaciones |
| Premios en monedas | 100 / 60 / 30 para el podio, 10 por haber jugado; solo cuenta tu mejor puesto y el grupo necesita al menos 2 personas que hayan jugado |
| Premio de los retos diarios | Monedas para estilos, no fichas: los retos son personales y no deben dar ventaja en la liga |
| Nombre | Blackjack with Friends |
| Dominio | El del servidor casero (ZimaOS), con HTTPS por proxy inverso o túnel |
| Invitaciones | Enlace con vista previa enriquecida + código QR |
| Login | Usuario y contraseña, sin correos (sin Google ni Apple) |
| Estructura | Monorepo con npm workspaces: `frontend/`, `backend/` y `packages/engine/`; frontend y backend van juntos en una imagen Docker (`docker/`) |
