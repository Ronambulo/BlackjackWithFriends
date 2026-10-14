'use client'

import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/ui/EmptyState'
import { TrophyIcon } from '@/ui/icons'

export default function Page() {
  const { t } = useTranslation()
  return <EmptyState icon={<TrophyIcon />} title={t('ranking.title')} text={t('ranking.empty')} />
}
