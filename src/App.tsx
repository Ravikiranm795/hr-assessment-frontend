import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { DeviceGate } from '@/app/DeviceGate'
import { Providers } from '@/app/Providers'
import { RouteFallback } from '@/app/RouteFallback'
import { router } from '@/app/router'

export default function App() {
  return (
    <DeviceGate>
      <Providers>
        <Suspense fallback={<RouteFallback />}>
          <RouterProvider router={router} />
        </Suspense>
      </Providers>
    </DeviceGate>
  )
}
