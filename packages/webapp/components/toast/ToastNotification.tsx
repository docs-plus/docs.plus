import toast, { ToastOptions } from 'react-hot-toast'

export type TToastOpt = ToastOptions & {
  displayBtnClose: boolean
  displayIcon: boolean
  icon: JSX.Element
  iconClassName: string
  textColor: string
}

const defaultOpts: TToastOpt = {
  displayBtnClose: true,
  displayIcon: true,
  position: 'bottom-center',
  icon: <></>, // default empty icon
  iconClassName: '',
  textColor: ''
}

export const ToastNotification = (message: string, options?: Partial<TToastOpt>) => {
  const opts: TToastOpt = { ...defaultOpts, ...options }

  return toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-fadeIn' : 'animate-fadeOut'
        } join flex w-auto min-w-60 items-center rounded-md border border-none bg-base-100 p-0 shadow-lg`}>
        {opts.displayIcon && (
          <div className={`join-item px-2 ${opts.iconClassName}`}>{opts.icon}</div>
        )}
        <div className={`join-item px-4 ${opts.textColor}`}>
          <span>{message}</span>
        </div>
        {opts.displayBtnClose && (
          <button onClick={() => toast.dismiss(t.id)} className="btn btn-ghost join-item !border-l">
            Close
          </button>
        )}
      </div>
    ),
    opts
  )
}
