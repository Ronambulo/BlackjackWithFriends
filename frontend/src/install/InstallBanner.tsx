import { useInstallPrompt } from './useInstallPrompt'
import './InstallBanner.css'

function ShareIcon() {
  return (
    <svg className="install-inline-icon" viewBox="0 0 24 24" aria-label="Compartir" role="img">
      <path
        d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function InstallBanner() {
  const { platform, installed, dismissed, canPromptInstall, install, dismiss } = useInstallPrompt()

  if (installed || dismissed) return null
  // On desktop we only show the banner when the browser can install directly.
  if (platform === 'other' && !canPromptInstall) return null

  return (
    <aside className="install-banner" role="dialog" aria-labelledby="install-title">
      <button className="install-close" onClick={dismiss} aria-label="Cerrar">
        ×
      </button>
      <img className="install-icon" src="/pwa-192x192.png" alt="" width={48} height={48} />
      <div className="install-body">
        <h2 id="install-title">Instala Blackjack with Friends</h2>

        {canPromptInstall ? (
          <>
            <p>Juega a pantalla completa y ábrela desde tu pantalla de inicio.</p>
            <button className="install-button" onClick={install}>
              Instalar app
            </button>
          </>
        ) : platform === 'ios' ? (
          <ol>
            <li>
              Toca el botón <strong>Compartir</strong> <ShareIcon /> (si no lo ves, está en el menú{' '}
              <strong>•••</strong>).
            </li>
            <li>
              Elige <strong>Añadir a pantalla de inicio</strong>.
            </li>
            <li>
              Pulsa <strong>Añadir</strong>.
            </li>
          </ol>
        ) : (
          <ol>
            <li>
              Abre el menú <strong>⋮</strong> del navegador.
            </li>
            <li>
              Elige <strong>Instalar app</strong> o <strong>Añadir a pantalla de inicio</strong>.
            </li>
          </ol>
        )}
      </div>
    </aside>
  )
}
