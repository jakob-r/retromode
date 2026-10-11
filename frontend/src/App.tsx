import { MotionConfig } from 'motion/react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Background } from './components/Background'
import { Toasts } from './components/Toasts'
import { BoardPage } from './routes/BoardPage'
import { Landing } from './routes/Landing'
import { NotFound } from './routes/NotFound'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/b/:slug', element: <BoardPage /> },
  { path: '*', element: <NotFound /> },
])

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Background />
      <RouterProvider router={router} />
      <Toasts />
    </MotionConfig>
  )
}
