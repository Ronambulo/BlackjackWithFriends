import styles from './Splash.module.css'

/** Shown while the saved session and the profile load. No text, so the language doesn't matter yet. */
export function Splash() {
  return (
    <div className={styles.splash} aria-busy="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny local SVG, no optimisation needed */}
      <img className={styles.logo} src="/icon.svg" alt="" width={88} height={88} />
    </div>
  )
}
