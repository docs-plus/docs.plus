import React, { useEffect } from 'react'

type TModal = {
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  children: React.ReactNode
  id?: string
  [x: string]: any
  asAChild?: boolean
}

const Modal = ({ isOpen, setIsOpen, children, id, asAChild = true }: TModal) => {
  const modalId = `modal_${Math.random().toString(36).substr(2, 9)}` || id

  useEffect(() => {
    const closeOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }

    window.addEventListener('keydown', closeOnEsc)

    return () => {
      window.removeEventListener('keydown', closeOnEsc)
    }
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <div>
      <input
        type="checkbox"
        id={modalId}
        className="modal-toggle"
        checked={isOpen}
        onChange={() => {
          console.info('hi man!')
        }}
        onClick={() => {
          console.info('clik')
        }}
      />
      <div className="modal z-50 size-full bg-slate-300/20 backdrop-blur-sm" role="dialog">
        <div className={`modal-box ${!asAChild ? 'max-h-fit max-w-fit p-0' : 'p-3'} `}>
          {children}
        </div>
        <label
          className="modal-backdrop size-full max-h-full max-w-full"
          htmlFor={modalId}
          onClick={() => setIsOpen(false)}></label>
      </div>
    </div>
  )
}

export default Modal
