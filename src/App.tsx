import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

export default function App() {
  useEffect(() => {
    // TODO: appStore.init()
  }, [])

  return <RouterProvider router={router} />
}
