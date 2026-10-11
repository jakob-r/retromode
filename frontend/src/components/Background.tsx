import { Twinkle } from './Sparkles'

/** Soft drifting color blobs behind everything, plus a few idle sparkles. */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] animate-drift-a rounded-full bg-mint/25 blur-3xl" />
      <div className="absolute top-1/3 -right-40 h-[30rem] w-[30rem] animate-drift-b rounded-full bg-violet/20 blur-3xl" />
      <div className="absolute -bottom-48 left-1/4 h-[32rem] w-[32rem] animate-drift-c rounded-full bg-coral/20 blur-3xl" />
      <div className="absolute top-24 right-[12%]">
        <Twinkle size={16} delay={0.4} />
      </div>
      <div className="absolute bottom-[18%] left-[6%]">
        <Twinkle size={12} delay={1.3} color="var(--color-violet)" />
      </div>
      <div className="absolute top-[55%] right-[4%]">
        <Twinkle size={10} delay={2.1} color="var(--color-coral)" />
      </div>
    </div>
  )
}
