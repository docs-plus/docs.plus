import { Band, Note } from './HovercardParts'

const Bone = ({ className }: { className: string }) => (
  <div className="flex h-5 items-center">
    <div className={`skeleton ${className}`} />
  </div>
)

/** The body of both link hovercards before data: bones while it loads, else one line. */
export function HovercardPlaceholder({ state }: { state: 'loading' | 'empty' }) {
  if (state === 'empty') {
    return (
      <Band>
        <Note>No preview for this page.</Note>
      </Band>
    )
  }
  return (
    <Band busy>
      <Bone className="h-3.5 w-[72%]" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-[58%]" />
    </Band>
  )
}
