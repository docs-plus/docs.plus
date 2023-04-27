import Link from 'next/link'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import DocTitle from './DocTitle'
import {
  DocsPlus,
  Hamburger,
  Check
} from '../icons/Icons'

import OnlineIndicator from './OnlineIndicator'

import useDetectKeyboardOpen from "use-detect-keyboard-open";


const PadTitle = ({ docTitle, docId, docSlug, provider, editor }) => {
  const queryClient = useQueryClient()

  const isKeyboardOpen = useDetectKeyboardOpen();


  const { isLoading, isSuccess, mutate } = useMutation({
    mutationKey: ['updateDocumentMetadata'],
    mutationFn: ({ title, docId }) => {
      // NOTE: This is a hack to get the correct URL in the build time
      const url = `${ process.env.NEXT_PUBLIC_RESTAPI_URL }/documents/${ docId.split('.').at(-1) }`


      return fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      })
        .then(res => res.json())
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['getDocumentMetadataByDocName'], data)
    }
  })

  const saveData = (e) => {
    if (e.target.innerText === docTitle) return
    mutate({
      title: e.target.innerText,
      docId: docId.split('.').at(-1)
    })
  }

  const btn_leftOpenModal = (e) => {
    if (!e.target.closest('button').classList.contains('btn_modal')) return

    const leftModal = document.querySelector('.nd_modal.left')
    leftModal.classList.remove('hidden')

    const modalBg = leftModal.querySelector('.modalBg')
    modalBg.classList.add('active')

    setTimeout(() => {
      leftModal.querySelector('.modalWrapper').classList.add('active')
    }, 200)
  }

  const btn_blurEditor = () => {
    console.log("Remove the focus from the editor")
    // Remove the focus from the editor
    editor?.commands.blur()
  }

  return (
    <div className='flex flex-row items-center w-full sm:w-auto justify-center sm:justify-normal'>
      <div className='padLog hidden sm:block'>
        <Link href="/">
          <DocsPlus size="34" />
        </Link>
      </div>
      <div className='sm:hidden'>
        {isKeyboardOpen ? <button onTouchStart={btn_blurEditor} className="w-10 h-10 flex align-middle justify-center items-center">
          <Check size="30" />
        </button> : <button onTouchStart={btn_leftOpenModal} className="btn_modal w-10 h-10 flex align-middle justify-center items-center" type="button">
          <Hamburger size="30" />
        </button>
        }
      </div>
      <DocTitle docId={docId} docTitle={docTitle} />
      <div className='w-10 h-10 border rounded-full bg-gray-400 ml-auto sm:hidden'></div>
      <OnlineIndicator className="hidden sm:block " />
    </div>
  )
}

export default PadTitle
