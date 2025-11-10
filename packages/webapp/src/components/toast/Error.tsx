import { ToastNotification, TToastOpt } from './ToastNotification'

export const Error = (message: string, options?: Partial<TToastOpt>) => {
  return ToastNotification(message, {
    ...options,
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="size-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    iconClassName: 'text-error',
    textColor: 'text-error-content'
  })
}
