import { AnimatePresence, motion } from 'motion/react'
import { Check, ClipboardCopy } from 'lucide-react'
import { useState } from 'react'
import { copyText } from '../lib/clipboard'
import { actionItemsForSlack } from '../lib/model'
import { useBoard } from '../store/board'
import { toast } from '../store/toasts'
import { useItemsHidden } from './Obscured'

/** Copies the action items to the clipboard, formatted to paste into Slack. */
export function CopyActionsButton({ className = '' }: { className?: string }) {
  const [copied, setCopied] = useState(false)
  const hidden = useItemsHidden()
  const text = useBoard((s) =>
    s.board ? actionItemsForSlack({ items: s.items, groups: s.groups }, s.board.title) : null,
  )
  if (!text || hidden) return null

  const copy = async () => {
    await copyText(text)
    setCopied(true)
    toast('Action items copied – paste them into Slack', 'success')
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={copy}
      title="Copy the action items, formatted for Slack"
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? 'done' : 'copy'}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {copied ? <Check size={14} strokeWidth={3} /> : <ClipboardCopy size={14} />}
        </motion.span>
      </AnimatePresence>
      {copied ? 'Copied!' : 'Copy for Slack'}
    </motion.button>
  )
}
