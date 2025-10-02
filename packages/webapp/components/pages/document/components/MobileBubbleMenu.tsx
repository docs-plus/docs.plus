import { BubbleMenu } from '@tiptap/react/menus'
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
          className="bubble-menu join bg-base-100 rounded-[10px] drop-shadow-lg"
          options={{
            placement: 'top',
            offset: 6
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
