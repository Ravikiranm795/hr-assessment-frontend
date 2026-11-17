import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const MIN_WIDTH = 900
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i

function isUnsupported() {
  return window.innerWidth < MIN_WIDTH || MOBILE_UA.test(navigator.userAgent)
}

/** Desktop and laptop only (spec F-01): below 900 px or on a phone/tablet only a message is shown. */
export function DeviceGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [unsupported, setUnsupported] = useState(isUnsupported)

  useEffect(() => {
    const onResize = () => setUnsupported(isUnsupported())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The candidate exam has its own device check; unmounting it on a resize would drop the camera and fullscreen.
  if (!unsupported || window.location.pathname.startsWith('/exam/')) return <>{children}</>
  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-center" role="alert">
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold">{t('device.unsupported.title')}</h1>
        <p className="mt-3 text-muted">{t('device.unsupported.body')}</p>
      </div>
    </main>
  )
}
