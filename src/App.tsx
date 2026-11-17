import { RouterProvider } from 'react-router-dom'
import { DeviceGate } from '@/app/DeviceGate'
import { Providers } from '@/app/Providers'
import { router } from '@/app/router'

export default function App() {
  return (
    <DeviceGate>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </DeviceGate>
  )
}
