import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ActionItemDialog } from '../components/ActionItemDialog'
import { BoardColumns } from '../components/BoardColumns'
import { Header } from '../components/Header'
import { LinkDialog } from '../components/LinkDialog'
import { LockBanner } from '../components/LockBanner'
import { MergeDialog } from '../components/MergeDialog'
import { NicknameDialog } from '../components/NicknameDialog'
import { ShareDialog } from '../components/ShareDialog'
import { SparkleShape } from '../components/Sparkles'
import { FocusDim, TimeUpBurst } from '../components/TimeUp'
import { hasAnsweredNickname, setOwnerKey } from '../lib/identity'
import { celebrate } from '../lib/motion'
import { connectBoard, useBoard } from '../store/board'
import { useMe } from '../store/me'
import { NotFound } from './NotFound'

export function BoardPage() {
  const { slug = '' } = useParams()
  const [search] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const justCreated = !!(location.state as { justCreated?: boolean } | null)?.justCreated
  const [shareOpen, setShareOpen] = useState(false)

  // An admin link (?owner=…) stores the owner key on this device, then hides it from the URL.
  const ownerParam = search.get('owner')
  if (ownerParam) setOwnerKey(slug, ownerParam)
  useEffect(() => {
    if (ownerParam) navigate(`/b/${slug}`, { replace: true, state: location.state })
  }, [ownerParam, slug, navigate, location.state])

  useEffect(() => connectBoard(slug), [slug])

  const status = useBoard((s) => s.status)
  const board = useBoard((s) => s.board)
  const online = useBoard((s) => s.online)
  const timerRunning = useBoard((s) => s.timerEndsAt !== null)
  const timeUps = useBoard((s) => s.timeUps)
  const [timeUp, setTimeUp] = useState(false)

  useEffect(() => {
    if (timeUps === 0) return
    setTimeUp(true)
    const id = setTimeout(() => setTimeUp(false), 2200)
    return () => clearTimeout(id)
  }, [timeUps])

  useEffect(() => {
    if (status !== 'ready') return
    if (justCreated) {
      celebrate()
      setShareOpen(true)
      // Don't celebrate again on reload
      window.history.replaceState({}, '')
    } else if (!hasAnsweredNickname()) {
      useMe.getState().openNicknameDialog()
    }
  }, [status === 'ready', justCreated]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (board) document.title = `${board.title} · Retromode`
    return () => {
      document.title = 'Retromode'
    }
  }, [board?.title]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'not-found') return <NotFound what="board" />
  if (!board) return <Loading />

  return (
    <main
      className={`mx-auto max-w-[96rem] px-4 pb-10 sm:px-6 ${board.locked ? 'board-locked' : ''} ${timeUp ? 'time-up' : ''}`}
    >
      <FocusDim active={timerRunning} />
      {timeUp && <TimeUpBurst key={timeUps} seed={timeUps} />}
      <Header board={board} online={online} status={status} onShare={() => setShareOpen(true)} />
      <LockBanner locked={board.locked} isOwner={board.isOwner} />
      <BoardColumns board={board} />
      <ShareDialog
        open={shareOpen}
        onClose={() => {
          setShareOpen(false)
          if (justCreated && !hasAnsweredNickname()) useMe.getState().openNicknameDialog()
        }}
        slug={slug}
        isOwner={board.isOwner}
        justCreated={justCreated}
      />
      <NicknameDialog />
      <MergeDialog />
      <LinkDialog />
      <ActionItemDialog />
    </main>
  )
}

function Loading() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      role="status"
      aria-label="Loading board"
    >
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <SparkleShape size={40} />
      </motion.div>
    </div>
  )
}
