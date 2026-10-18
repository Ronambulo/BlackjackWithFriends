import { useTranslation } from 'react-i18next'
import styles from './admin.module.css'

export type Sign = 1 | -1

/** The amount as a number, sign included: 0 when it's empty or not a number. */
export const signedAmount = (sign: Sign, digits: string) => (/^\d{1,7}$/.test(digits) ? sign * Number(digits) : 0)

/**
 * An amount to give or take away. The sign is a toggle of its own: phones show a keypad
 * with no + or - for numeric fields.
 */
export function SignedAmount({
  sign,
  digits,
  onSign,
  onDigits,
}: {
  sign: Sign
  digits: string
  onSign: (sign: Sign) => void
  onDigits: (digits: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="field">
      <span className="field-label">{t('admin.adjust.amount')}</span>
      <div className={styles.signed}>
        <div className={styles.sign} role="group" aria-label={t('admin.adjust.amount')}>
          <button type="button" aria-pressed={sign === 1} onClick={() => onSign(1)}>
            {t('admin.adjust.give')}
          </button>
          <button type="button" aria-pressed={sign === -1} onClick={() => onSign(-1)}>
            {t('admin.adjust.take')}
          </button>
        </div>
        <input
          className="input"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="500"
          maxLength={7}
          aria-label={t('admin.adjust.amount')}
          value={digits}
          onChange={(e) => onDigits(e.target.value.replace(/\D/g, ''))}
        />
      </div>
    </div>
  )
}
