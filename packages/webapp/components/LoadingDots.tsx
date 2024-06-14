import React, { ReactNode } from 'react'

export const LoadingDots = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex size-full h-dvh items-center justify-center">
      {children}
      <span className="loading loading-dots loading-xs ml-2 mt-2"></span>
    </div>
  )
}
