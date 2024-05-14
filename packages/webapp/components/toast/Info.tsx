import { ToastNotification, TToastOpt } from './ToastNotification'

export const Info = (message: string, options?: Partial<TToastOpt>) => {
  return ToastNotification(message, {
    ...options,
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        className="size-6 shrink-0 stroke-current">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    ),
    iconClassName: 'text-info',
    textColor: 'text-info-content'
  })
}
