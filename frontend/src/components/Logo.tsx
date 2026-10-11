import { Link } from 'react-router'
import { Twinkle } from './Sparkles'

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <Link
      to="/"
      className={`group relative inline-flex items-center font-display font-extrabold tracking-tight ${
        size === 'lg' ? 'text-5xl sm:text-7xl' : 'text-xl'
      }`}
    >
      <span>retr</span>
      <span className="bg-gradient-to-br from-mint via-violet to-coral bg-clip-text text-transparent">
        o
      </span>
      <span>mo</span>
      <span className="text-ink-soft">.</span>
      <span>de</span>
      <Twinkle size={size === 'lg' ? 22 : 10} className="absolute -top-1 -right-3" />
    </Link>
  )
}
