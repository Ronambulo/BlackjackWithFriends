import { InstallBanner } from './install/InstallBanner'

function App() {
  return (
    <>
      <main className="home">
        <img className="home-logo" src="/icon.svg" alt="" width={120} height={120} />
        <h1>Blackjack with Friends</h1>
        <p>Crea una sala y comparte el enlace con tus amigos.</p>
        <div className="home-actions">
          <button className="primary" disabled>
            Crear sala
          </button>
          <button className="secondary" disabled>
            Unirse con código
          </button>
        </div>
        <p className="home-soon">Próximamente</p>
      </main>
      <InstallBanner />
    </>
  )
}

export default App
