import { Link } from 'react-router'
import { LegalLinks } from '../components/LegalLinks'

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl">🫥</div>
      <h1 className="mt-4 font-display text-3xl font-bold">This {what} doesn't exist</h1>
      <p className="mt-2 text-ink-soft">
        It may have been removed after a long time without activity.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-2xl bg-ink px-5 py-3 font-display font-bold text-white transition hover:bg-ink/90"
      >
        Create a new board
      </Link>
      <LegalLinks className="mt-10" />
    </main>
  )
}
