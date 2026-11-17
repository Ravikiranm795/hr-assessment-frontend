import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { buttonStyles } from '@/components/Button'
import { StatePage } from '@/components/StatePage'

export function NotFound() {
  const { t } = useTranslation()
  return (
    <StatePage
      title={t('notFound.title')}
      body={t('notFound.body')}
      action={
        <Link to="/" className={buttonStyles({ variant: 'primary' })}>
          {t('notFound.home')}
        </Link>
      }
    />
  )
}
