import MsgComposer from '../../MessageComposer'
import { ComposerBar } from './ComposerBar'

export const ComposerDesktopLayout = () => (
  <MsgComposer className="chat_editor_container m-auto flex w-[98%] flex-col">
    <ComposerBar variant="desktop" />
  </MsgComposer>
)
