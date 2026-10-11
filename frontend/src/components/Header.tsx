import { AnimatePresence, motion } from 'motion/react'
import { Share2, Users, WifiOff } from 'lucide-react'
import type { PublicBoard } from '@retromode/shared'
import type { Status } from '../store/board'
import { useBoard } from '../store/board'
import { useMe } from '../store/me'
import { Logo } from './Logo'
import { SettingsPopover } from './SettingsPopover'
import { TimerControl } from './TimerControl'

export function Header({
  board,
  online,
  status,
  onShare,
}: {
  board: PublicBoard
  online: number
  status: Status
  onShare: () => void
}) {
  const nickname = useMe((s) => s.nickname)
  const openNicknameDialog = useMe((s) => s.openNicknameDialog)
  const timerRunning = useBoard((s) => s.timerEndsAt !== null)

  return (
    <header
      data-focus={timerRunning}
      className="board-header sticky top-0 z-30 -mx-4 mb-4 bg-cream/75 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Logo />
        <h1 className="order-last w-full min-w-0 truncate font-display text-2xl font-bold tracking-tight sm:order-none sm:w-auto sm:flex-1 sm:text-[1.7rem]">
          {board.title}
        </h1>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <AnimatePresence>
            {status === 'reconnecting' && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 rounded-full bg-coral-tint px-3 py-1.5 text-xs font-semibold text-coral-deep"
              >
                <WifiOff size={14} /> Reconnecting…
              </motion.span>
            )}
          </AnimatePresence>
          <span
            className="header-control flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-2 text-sm font-semibold shadow-sm sm:px-3"
            title={`${online} ${online === 1 ? 'person' : 'people'} here right now`}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
            </span>
            <Users size={15} className="max-sm:hidden" />
            <span className="tabular-nums">{online}</span>
          </span>
          <TimerControl />
          <button
            type="button"
            onClick={openNicknameDialog}
            className="header-control max-w-24 truncate rounded-full bg-white/80 px-2.5 py-2 text-sm font-medium shadow-sm transition hover:bg-white sm:max-w-40 sm:px-3"
            title="Change your nickname"
          >
            {nickname ? `👤 ${nickname}` : '🥷 Set nickname'}
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onShare}
            className="header-control flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-ink/90 sm:px-4"
          >
            <Share2 size={15} /> <span className="max-sm:hidden">Share</span>
          </motion.button>
          {board.isOwner && <SettingsPopover board={board} />}
        </div>
      </div>
    </header>
  )
}
