import { Link } from 'react-router'

const links = [
  { to: '/legal-notice', label: 'Legal notice (Impressum)' },
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms of use' },
]

/** Impressum, privacy policy and terms; German law requires them to be reachable from every page. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav
      aria-label="Legal"
      className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-ink-soft ${className}`}
    >
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="underline decoration-line underline-offset-4 transition hover:text-ink hover:decoration-ink"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
