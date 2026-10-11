import { useMe } from '../store/me'
import { Dialog } from './Dialog'
import { NicknameForm } from './NicknameForm'

export function NicknameDialog() {
  const open = useMe((s) => s.nicknameDialogOpen)
  const nickname = useMe((s) => s.nickname)
  const close = () => useMe.getState().closeNicknameDialog()
  const skip = () => {
    useMe.getState().answerNickname('')
    close()
  }

  return (
    <Dialog
      open={open}
      onClose={skip}
      title={nickname ? 'Change your nickname' : 'What should we call you?'}
    >
      <NicknameForm onDone={close} />
    </Dialog>
  )
}
