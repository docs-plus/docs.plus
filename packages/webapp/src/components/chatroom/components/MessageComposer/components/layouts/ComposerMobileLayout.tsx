import MsgComposer from '../../MessageComposer'
import { ComposerBar } from './ComposerBar'

export const ComposerMobileLayout = () => (
  <div className="chat_editor_container flex w-full flex-col">
    <MsgComposer>
      <ComposerBar variant="mobile" />
    </MsgComposer>
  </div>
)
