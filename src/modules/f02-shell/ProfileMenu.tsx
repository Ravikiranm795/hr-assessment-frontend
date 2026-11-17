import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { UserCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/core/auth/AuthProvider'

const item = 'cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-bg'

export function ProfileMenu() {
  const { t } = useTranslation()
  const { me, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  async function leave(everywhere: boolean) {
    try {
      await signOut(everywhere)
    } catch (error) {
      toast.error(error)
    }
    navigate('/login', { replace: true })
  }

  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm hover:bg-bg"
        aria-label={t('topbar.profile')}
      >
        <UserCircle className="size-8 text-muted" aria-hidden />
        <span className="max-w-40 truncate font-medium">{me?.user.name}</span>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={8} className="z-40 min-w-56 rounded-(--radius) border border-border bg-surface p-1 shadow-card">
          <div className="px-3 py-2 text-xs text-muted">{me?.user.email}</div>
          <Dropdown.Separator className="my-1 h-px bg-border" />
          <Dropdown.Item className={item} onSelect={() => navigate('/settings/profile')}>
            {t('settingsMenu.profile')}
          </Dropdown.Item>
          <Dropdown.Item className={item} onSelect={() => void leave(false)}>
            {t('topbar.signOut')}
          </Dropdown.Item>
          <Dropdown.Item className={item} onSelect={() => void leave(true)}>
            {t('topbar.signOutAll')}
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
