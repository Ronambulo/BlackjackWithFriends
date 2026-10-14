'use client'

import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/ui/EmptyState'
import { CardsIcon } from '@/ui/icons'

export default function Page() {
  const { t } = useTranslation()
  return <EmptyState icon={<CardsIcon />} title={t('play.title')} text={t('play.empty')} />
}
