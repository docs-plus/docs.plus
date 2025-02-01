// @ts-nocheck
import { BubbleMenu } from '@tiptap/react'
import { useStore } from '@stores'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'

type Props = {}

export const MobileBubbleMenu = ({}: Props) => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const { createComment } = useTurnSelectedTextIntoComment()

  return (
    <div>
      {editor && (
        <BubbleMenu
          className="bubble-menu join rounded-[10px] bg-base-100 drop-shadow-lg"
          tippyOptions={{
            duration: 100,
            hideOnClick: true
          }}
          editor={editor}>
          <button
            className="bt btn-ghost join-item flex max-h-[42px] min-h-[42px] items-center px-4"
            onClick={() => createComment(editor)}>
            Add Comments
          </button>
          <div className="divider divider-horizontal m-0"></div>
          <button
            className="btn btn-ghost join-item max-h-[42px] min-h-[42px] px-4"
            onClick={() => editor.chain().focus().setHyperlink().run()}>
            Insert Link
          </button>
        </BubbleMenu>
      )}
    </div>
  )
}
