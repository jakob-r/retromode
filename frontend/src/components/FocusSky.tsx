import type { CSSProperties } from 'react'

const STARS = [
  { x: 5, y: 14, size: 38, delay: -1.2 },
  { x: 21, y: 9, size: 24, delay: -3.4 },
  { x: 43, y: 17, size: 32, delay: -0.6 },
  { x: 68, y: 10, size: 26, delay: -2.5 },
  { x: 91, y: 20, size: 44, delay: -4.1 },
  { x: 3, y: 46, size: 26, delay: -2.8 },
  { x: 97, y: 53, size: 30, delay: -0.9 },
  { x: 10, y: 76, size: 48, delay: -3.7 },
  { x: 31, y: 87, size: 30, delay: -1.8 },
  { x: 53, y: 73, size: 40, delay: -4.6 },
  { x: 74, y: 91, size: 26, delay: -2.1 },
  { x: 89, y: 79, size: 46, delay: -0.3 },
]

/** A quiet night sky behind the board during the shared focus timer. */
export function FocusSky({ active, hideItems = false }: { active: boolean; hideItems?: boolean }) {
  return (
    <div
      className="focus-sky pointer-events-none fixed inset-0 -z-[5] overflow-hidden"
      data-active={active}
      aria-hidden="true"
    >
      {STARS.map((star, i) => (
        <svg
          key={i}
          className="focus-star absolute"
          viewBox="0 0 64 64"
          width={star.size}
          height={star.size}
          style={
            {
              left: `${star.x}%`,
              top: `${star.y}%`,
              '--star-delay': `${star.delay}s`,
              '--star-duration': `${4.5 + (i % 4) * 0.7}s`,
            } as CSSProperties
          }
        >
          <path
            d="M32 5 Q34 5 36 11 L41 23 L55 25 Q62 26 57 31 L46 40 L49 54 Q51 61 45 57 L32 49 L19 57 Q13 61 15 54 L18 40 L7 31 Q2 26 9 25 L23 23 L28 11 Q30 5 32 5Z"
            fill={i % 3 === 0 ? '#ffe8ad' : '#fff3cd'}
          />
          {hideItems ? (
            <path
              d="M23 29 Q26 32 29 29 M35 29 Q38 32 41 29"
              fill="none"
              stroke="#51416b"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <g fill="#51416b">
              <ellipse cx="26" cy="32" rx="1.8" ry="2.5" />
              <ellipse cx="38" cy="32" rx="1.8" ry="2.5" />
            </g>
          )}
          <path
            d="M28 38 Q32 42 36 38"
            fill="none"
            stroke="#51416b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g fill="#f5a7b5" opacity="0.7">
            <ellipse cx="22" cy="37" rx="3" ry="1.8" />
            <ellipse cx="42" cy="37" rx="3" ry="1.8" />
          </g>
          {hideItems &&
            [false, true].map((mirrored) => (
              <g
                key={String(mirrored)}
                transform={mirrored ? 'translate(64 0) scale(-1 1)' : undefined}
                stroke="#b58a65"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 40 Q18 35 23 34" fill="none" strokeWidth="2.5" />
                <path
                  d="M23 36 Q20 35 21 32 L21 28 Q21 26 23 27 L24 30 L24 26 Q24 24 26 26 L27 30 L28 27 Q29 26 30 28 L30 33 Q30 37 26 37Z"
                  fill="#ffe8c5"
                />
                <path d="M24 31 L25 33 M27 31 L28 33" fill="none" />
              </g>
            ))}
        </svg>
      ))}
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className="focus-stardust absolute rounded-full bg-[#fff3cd]"
          style={
            {
              left: `${(i * 37 + 11) % 100}%`,
              top: `${(i * 23 + 7) % 100}%`,
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              '--star-delay': `${-(i % 9) * 0.6}s`,
              '--star-duration': `${3 + (i % 5) * 0.8}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
