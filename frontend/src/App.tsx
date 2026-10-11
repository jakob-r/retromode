import { MotionConfig } from 'motion/react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { Background } from './components/Background'
import { Toasts } from './components/Toasts'
import { BoardPage } from './routes/BoardPage'
import { Landing } from './routes/Landing'
import { ImprintPage, PrivacyPage, TermsPage } from './routes/LegalPages'
import { NotFound } from './routes/NotFound'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/b/:slug', element: <BoardPage /> },
  { path: '/legal-notice', element: <ImprintPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/impressum', element: <Navigate to="/legal-notice" replace /> },
  { path: '/datenschutz', element: <Navigate to="/privacy" replace /> },
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
