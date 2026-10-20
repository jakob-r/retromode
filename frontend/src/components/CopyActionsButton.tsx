import { AnimatePresence, motion } from 'motion/react'
import { Braces, Check, ClipboardCopy, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { copyText } from '../lib/clipboard'
import { actionItemsForSlack, boardAsJson } from '../lib/model'
import { useBoard } from '../store/board'
import { toast } from '../store/toasts'
import { useItemsHidden } from './Obscured'

interface CopyButtonProps {
  /** Computed on click, so it's always fresh */
  getText: () => string | null
  label: string
  title: string
  copiedMessage: string
  icon: LucideIcon
  className?: string
}

function CopyButton({
  getText,
  label,
  title,
  copiedMessage,
  icon: Icon,
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const text = getText()
    if (!text) return
    await copyText(text)
    setCopied(true)
    toast(copiedMessage, 'success')
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={copy}
      title={title}
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
          {copied ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
        </motion.span>
      </AnimatePresence>
      {copied ? 'Copied!' : label}
    </motion.button>
  )
}

/** Copies the action items to the clipboard, formatted to paste into Slack. */
export function CopyActionsButton({ className = '' }: { className?: string }) {
  const hidden = useItemsHidden()
  const text = useBoard((s) =>
    s.board ? actionItemsForSlack({ items: s.items, groups: s.groups }, s.board.title) : null,
  )
  if (!text || hidden) return null

  return (
    <CopyButton
      getText={() => text}
      label="Copy for Slack"
      title="Copy the action items, formatted for Slack"
      copiedMessage="Action items copied – paste them into Slack"
      icon={ClipboardCopy}
      className={className}
    />
  )
}

/** Copies the whole board (columns, groups, items, votes, links) as JSON. */
export function CopyBoardButton({ className = '' }: { className?: string }) {
  const hidden = useItemsHidden()
  const hasBoard = useBoard((s) => !!s.board)
  if (!hasBoard || hidden) return null

  const getText = () => {
    const { board, items, groups } = useBoard.getState()
    return board ? JSON.stringify(boardAsJson({ items, groups }, board), null, 2) : null
  }

  return (
    <CopyButton
      getText={getText}
      label="Copy JSON"
      title="Copy the whole board as JSON"
      copiedMessage="Board copied as JSON"
      icon={Braces}
      className={className}
    />
  )
}
