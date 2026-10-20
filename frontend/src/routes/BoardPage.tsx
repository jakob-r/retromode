import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ActionItemDialog } from '../components/ActionItemDialog'
import { BoardColumns } from '../components/BoardColumns'
import { FocusSky } from '../components/FocusSky'
import { Header } from '../components/Header'
import { LegalLinks } from '../components/LegalLinks'
import { LinkDialog } from '../components/LinkDialog'
import { LockBanner } from '../components/LockBanner'
import { MergeDialog } from '../components/MergeDialog'
import { NicknameDialog } from '../components/NicknameDialog'
import { ShareDialog } from '../components/ShareDialog'
import { SparkleShape } from '../components/Sparkles'
import { TimeUpBurst } from '../components/TimeUp'
import { hasAnsweredNickname, setOwnerKey } from '../lib/identity'
import { celebrate } from '../lib/motion'
import { registerBoardTools } from '../store/agentTools'
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
  const [askName, setAskName] = useState(false)

  // An admin link (?owner=…) stores the owner key on this device, then hides it from the URL.
  const ownerParam = search.get('owner')
  if (ownerParam) setOwnerKey(slug, ownerParam)
  useEffect(() => {
    if (ownerParam) navigate(`/b/${slug}`, { replace: true, state: location.state })
  }, [ownerParam, slug, navigate, location.state])

  useEffect(() => connectBoard(slug), [slug])
  useEffect(() => registerBoardTools(), [])

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
      setAskName(!hasAnsweredNickname())
      setShareOpen(true)
      // Don't celebrate again on reload
      window.history.replaceState({}, '')
    } else if (!hasAnsweredNickname()) {
      useMe.getState().openNicknameDialog()
    }
  }, [status === 'ready', justCreated]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (board) document.title = `${board.title} · retromo.de`
    return () => {
      document.title = 'retromo.de'
    }
  }, [board?.title]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'not-found') return <NotFound what="board" />
  if (status === 'nuked') return <Nuked />
  if (!board) return <Loading />

  return (
    <main
      className={`mx-auto max-w-[96rem] px-4 pb-10 sm:px-6 ${board.locked ? 'board-locked' : ''} ${timeUp ? 'time-up' : ''}`}
    >
      <FocusSky active={timerRunning} hideItems={timerRunning && !!board.timer?.hideItems} />
      {timeUp && <TimeUpBurst key={timeUps} seed={timeUps} />}
      <Header
        board={board}
        online={online}
        status={status}
        onShare={() => {
          setAskName(false)
          setShareOpen(true)
        }}
      />
      <LockBanner locked={board.locked} isOwner={board.isOwner} />
      <BoardColumns board={board} />
      <LegalLinks className="mt-10" />
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        slug={slug}
        isOwner={board.isOwner}
        justCreated={justCreated}
        askName={askName}
      />
      <NicknameDialog />
      <MergeDialog />
      <LinkDialog />
      <ActionItemDialog />
    </main>
  )
}

function Nuked() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <motion.div
        className="text-7xl"
        initial={{ scale: 0.2, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 12 }}
      >
        💥
      </motion.div>
      <h1 className="mt-4 font-display text-3xl font-bold">This board was nuked</h1>
      <p className="mt-2 text-ink-soft">Everything on it is gone for good.</p>
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
