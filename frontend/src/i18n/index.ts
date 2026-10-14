import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { en } from './en'
import { es } from './es'

export const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
] as const

export type Language = (typeof LANGUAGES)[number]['code']

const isBrowser = typeof window !== 'undefined'

export function currentLanguage(): Language {
  return i18n.resolvedLanguage === 'en' ? 'en' : 'es'
}

if (!i18n.isInitialized) {
  // On the server there is no browser language: render Spanish and let the client switch.
  if (isBrowser) i18n.use(LanguageDetector)
  void i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: isBrowser ? undefined : 'es',
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    load: 'languageOnly',
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'lang', caches: ['localStorage'] },
    interpolation: { escapeValue: false },
  })
  if (isBrowser) {
    document.documentElement.lang = currentLanguage()
    i18n.on('languageChanged', () => {
      document.documentElement.lang = currentLanguage()
    })
  }
}

export default i18n
