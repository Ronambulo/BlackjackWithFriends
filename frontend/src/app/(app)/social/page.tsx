'use client'

import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/ui/EmptyState'
import { ChatIcon } from '@/ui/icons'

export default function Page() {
  const { t } = useTranslation()
  return <EmptyState icon={<ChatIcon />} title={t('social.title')} text={t('social.empty')} />
}
