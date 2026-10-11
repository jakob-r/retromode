import { AnimatePresence, motion } from 'motion/react'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Clipboard API needs a secure context; fall back to selecting the text
      const input = document.createElement('textarea')
      input.value = value
      document.body.append(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-1.5 pl-3">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.target.select()}
        className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-ink-soft outline-none"
      />
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={copy}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white transition-colors ${
          copied ? 'bg-mint-deep' : 'bg-ink hover:bg-ink/90'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'done' : 'copy'}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {copied ? <Check size={15} strokeWidth={3} /> : <Copy size={15} />}
          </motion.span>
        </AnimatePresence>
        {copied ? 'Copied!' : 'Copy'}
      </motion.button>
    </div>
  )
}
