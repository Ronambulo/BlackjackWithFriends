/** The last screen the player was on outside settings, so a problem report says where it happened. */
let last: string | null = null

export function rememberScreen(pathname: string) {
  if (pathname !== '/ajustes') last = pathname
}

export function lastScreen(): string | null {
  return last
}
