import React, { useCallback, useEffect, useState } from 'react'
import { CaretRight, ChatLeft } from '@icons'
import PubSub from 'pubsub-js'
import ENUMS from './enums'
import slugify from 'slugify'
import { useStore, useChatStore, useAuthStore } from '@stores'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

const getOffsetTop = (element) =>
  element ? element.offsetTop + getOffsetTop(element.offsetParent) : 0

const getHeadingDetails = (id) => {
  const headingSection = document.querySelector(`.ProseMirror .heading[data-id="${id}"]`)
  const offsetTop = getOffsetTop(headingSection)
  return { headingSection, offsetTop }
}

const TableOfContent = ({ editor, className }) => {
  const [items, setItems] = useState([])
  const { query } = useRouter()
  const setChatRoom = useChatStore((state) => state.setChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const { workspaceId } = useStore((state) => state.settings)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const user = useAuthStore((state) => state.profile)

  const handleUpdate = useCallback((doc) => {
    const headings = []
    const editorDoc = doc.editor?.state?.doc || doc.state.doc

    editorDoc?.descendants((node, _pos, _parent) => {
      if (node.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
        let headingId = _parent.attrs?.id || node?.attrs.id || '1'
        let { headingSection, offsetTop } = getHeadingDetails(headingId)

        if (offsetTop === 0) {
          headingId = '1'
          let headingDetails = getHeadingDetails(headingId)
          headingSection = headingDetails.headingSection
          offsetTop = headingDetails.offsetTop
        }

        headings.push({
          level: node.attrs?.level,
          text: node?.textContent,
          id: headingId,
          open: headingSection?.classList.contains('opend'),
          offsetTop: offsetTop
        })
      }
    })

    setItems(headings)
  }, [])

  useEffect(() => {
    if (!editor) return null

    let trTimer

    editor.on('transaction', (tr) => {
      if (tr.transaction.selection.$anchor.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
        handleUpdate(tr)
      }

      if (
        tr.transaction.meta?.foldAndunfold ||
        tr.transaction.meta?.renderTOC ||
        tr.transaction.meta?.paste
      ) {
        trTimer = setTimeout(() => {
          handleUpdate(tr)
        }, 1000)
      }
    })

    const timer = setTimeout(() => {
      handleUpdate(editor)
    }, 200)

    return () => {
      editor.off('transaction')
      editor.off('update')
      clearTimeout(timer)
      clearTimeout(trTimer)
    }
  }, [editor])

  useEffect(() => {
    const transaction = editor.state.tr
    transaction.setMeta('renderTOC', true)
    editor.view.dispatch(transaction)

    const timer = setTimeout(() => {
      handleUpdate(editor)
    }, 200)

    return () => clearTimeout(timer)
  }, [])

  const scroll2Header = useCallback(
    (e) => {
      e.preventDefault()
      let id = e.target.getAttribute('data-id')
      const offsetParent = getOffsetTop(e.target.closest('.toc__item'))

      if (offsetParent === 0) id = '1'

      const nodePos = editor.view.state.doc.resolve(
        editor?.view.posAtDOM(document.querySelector(`.heading[data-id="${id}"]`))
      )

      const headingPath = nodePos.path
        .filter((x) => x?.type?.name === ENUMS.NODES.HEADING_TYPE)
        .map((x) => slugify(x.firstChild.textContent.toLowerCase().trim()))

      const url = new URL(window.location.href)
      url.searchParams.set('h', headingPath.join('>'))
      url.searchParams.set('id', id)
      window.history.replaceState({}, '', url)

      document.querySelector(`.heading[data-id="${id}"]`)?.scrollIntoView()
    },
    [editor]
  )

  const toggleSection = useCallback((item) => {
    const itemElement = document.querySelector(`.toc__item[data-id="${item.id}"]`)
    const btnFoldElement = itemElement.querySelector(`.btnFold`)
    const childrenWrapperElement = itemElement.querySelector('.childrenWrapper')

    itemElement.classList.toggle('closed')
    btnFoldElement.classList.toggle('closed')
    btnFoldElement.classList.toggle('opened')
    childrenWrapperElement?.classList.toggle('hidden')

    PubSub.publish(ENUMS.EVENTS.FOLD_AND_UNFOLD, { headingId: item.id, open: !item.open })
  }, [])

  const openChatContainerHandler = useCallback(
    (item) => {
      const nodePos = editor.view.state.doc.resolve(
        editor?.view.posAtDOM(document.querySelector(`.heading[data-id="${item.id}"]`))
      )

      if (!user) {
        toast.error('Please login to use chat feature')
        document.getElementById('btn_signin').click()
        return
      }

      // toggle chatroom
      if (headingId === item.id) {
        return destroyChatRoom()
      }

      destroyChatRoom()

      const headingPath = nodePos.path
        .filter((x) => x?.type?.name === ENUMS.NODES.HEADING_TYPE)
        .map((x) => {
          const text = x.firstChild.textContent.toLowerCase().trim()
          return { text, id: x.attrs.id }
        })

      const headingAddress = headingPath.map((x, index) => {
        const prevHeadingPath = headingPath
          .slice(0, index)
          .map((x) => slugify(x.text))
          .join('>')

        const slug = slugify(x.text)

        const url = new URL(window.location.origin + `/${query.slugs?.at(0)}`)
        url.searchParams.set('h', prevHeadingPath)
        url.searchParams.set('id', x.id)

        return {
          ...x,
          slug: slugify(x.text),
          url: url.href
        }
      })

      setChatRoom(item.id, workspaceId, headingAddress)
    },
    [editor, workspaceId, headingId]
  )

  const renderToc = useCallback(
    (items) => {
      const renderedItems = []
      for (let i = 0; i < items.length; ) {
        const item = items[i]
        const children = []
        let j = i + 1

        while (j < items.length && items[j].level > item.level) {
          children.push(items[j])
          j++
        }
        renderedItems.push(
          <div
            key={item.id}
            className={`toc__item toc__item--${item.level} ${item.open ? '' : 'closed'} `}
            data-id={item.id}
            data-offsettop={item.offsetTop}>
            <span className="group">
              <span
                className={`btnFold ${item.open ? 'opened' : 'closed'}`}
                onClick={() => toggleSection(item)}>
                <CaretRight size={17} fill="#363636" />
              </span>
              <a
                className="text-black sm:line-clamp-2 sm:hover:line-clamp-3 "
                data-id={item.id}
                href={`?${item.id}`}
                onClick={scroll2Header}>
                {item.text}
              </a>
              <span className="ml-auto" onClick={() => openChatContainerHandler(item)}>
                <ChatLeft
                  className={`btnChat ${headingId === item.id && '!opacity-100 fill-docsy'} transition-all ml-5 group-hover:fill-docsy hover:fill-indigo-900 cursor-pointer`}
                  size={18}
                />
              </span>
            </span>

            {children.length > 0 && (
              <div className={`childrenWrapper ${item.open ? '' : 'hidden'}`}>
                {renderToc(children)}
              </div>
            )}
          </div>
        )
        i = j
      }

      return renderedItems
    },
    [toggleSection, scroll2Header, headingId]
  )

  if (items.length) {
    const { id, offsetTop } = items.at(-1)
    if (id === '1' && offsetTop === 0) return null
  }

  return (
    <div className={`${className}`}>
      <div className="toc__list ">{renderToc(items)}</div>
    </div>
  )
}

export default React.memo(TableOfContent)
