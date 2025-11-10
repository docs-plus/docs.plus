import { useCallback } from 'react'
import { useStore } from '@stores'
import slugify from 'slugify'
import { TIPTAP_NODES } from '@types'
import * as toast from '@components/toast'
import { copyToClipboard } from '@utils/index'

const useLinkHeadingSectionHandler = (tocId: string) => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const linkHeadingSectionHandler = useCallback(() => {
    if (!tocId || !editor) return

    const targetHeading = document.querySelector(`.heading[data-id="${tocId}"]`)

    if (!targetHeading) return

    const posAt = editor?.view.posAtDOM(targetHeading, 0)
    if (posAt === -1) return

    const nodePos = editor.view.state.doc?.resolve(editor?.view.posAtDOM(targetHeading, 0))
    //@ts-ignore
    const headingPath = nodePos.path
      .filter((x: any) => x?.type?.name === TIPTAP_NODES.HEADING_TYPE)
      .map((x: any) => slugify(x.firstChild.textContent.toLowerCase().trim()))

    const url = new URL(window.location.href)
    url.searchParams.set('h', headingPath.join('>'))
    url.searchParams.set('id', tocId)

    copyToClipboard(url.toString())

    toast.Success('URL copied to clipboard')
  }, [tocId, editor])

  return linkHeadingSectionHandler
}

export default useLinkHeadingSectionHandler
