import type { Language } from '@/i18n'

/** One version of the app, as the players see it. Newest first; a new one goes on top. */
export interface Release {
  /** Never changes once published: the app remembers the newest one each player has seen. */
  id: string
  /** YYYY-MM-DD */
  date: string
  items: Record<Language, string[]>
}

export const RELEASES: Release[] = [
  {
    id: '2026-10-15-avisos',
    date: '2026-10-15',
    items: {
      es: [
        'Encuestas en Inicio: contesta con un toque y mira cómo va la votación.',
        'Puedes cambiar tu nombre de usuario desde Ajustes (una vez cada 30 días).',
        'Si algo falla, avísanos desde Ajustes → Avisar de un fallo.',
        'Esta pantalla, para ver lo nuevo de cada versión.',
      ],
      en: [
        'Polls on Home: answer with a tap and see how the vote is going.',
        'You can change your username from Settings (once every 30 days).',
        'If something breaks, tell us from Settings → Report a problem.',
        'This screen, to see what is new in each version.',
      ],
    },
  },
  {
    id: '2026-10-15-chat',
    date: '2026-10-15',
    items: {
      es: [
        'Chat global y de cada grupo, con reacciones, respuestas y manos compartidas.',
        'Menciona a alguien con @ y le llegará una notificación.',
        'Retos diarios que dan monedas: tres nuevos cada día.',
        'Notificaciones cuando te adelantan, te escriben o empieza la semana.',
        'Comparte tus estadísticas en el chat o como imagen para historias.',
      ],
      en: [
        'Global and group chat, with reactions, replies and shared hands.',
        'Mention someone with @ and they get a notification.',
        'Daily challenges that pay coins: three new ones every day.',
        'Notifications when someone overtakes you, writes to you or the week starts.',
        'Share your stats in the chat or as a story image.',
      ],
    },
  },
  {
    id: '2026-10-15-temporadas',
    date: '2026-10-15',
    items: {
      es: [
        'Temporadas semanales con podio y logros.',
        'Ranking de amigos y global, y un gráfico de la semana renovado.',
        'Fotos de perfil, recortadas dentro de la app.',
        'Sonidos en la mesa y fichas con colores de casino.',
      ],
      en: [
        'Weekly seasons with a podium and achievements.',
        'Friends and global rankings, and a reworked weekly chart.',
        'Profile photos, cropped inside the app.',
        'Table sounds and casino chip colours.',
      ],
    },
  },
  {
    id: '2026-10-14-grupos',
    date: '2026-10-14',
    items: {
      es: [
        'Grupos con clasificación en directo e invitaciones por enlace.',
        'Historial de tu saldo durante la semana.',
        'Mesa con tapete de casino y animaciones de reparto.',
        'Entrar con usuario y contraseña.',
      ],
      en: [
        'Groups with a live leaderboard and invite links.',
        'Your balance over the week.',
        'A casino felt table with dealing animations.',
        'Sign in with a username and password.',
      ],
    },
  },
]

const SEEN_KEY = 'novedades.visto'

/** The newest release this device has shown, or null if it never has. */
export function lastSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

export function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, RELEASES[0].id)
  } catch {
    // Private mode: it shows again next time, no harm done.
  }
}
