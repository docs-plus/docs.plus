import TextInput from '@components/ui/TextInput'
import { Icons } from '@icons'
import { useState } from 'react'

type KeywordTagsFieldProps = {
  value: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
  placeholder?: string
}

export function KeywordTagsField({
  value,
  onChange,
  disabled = false,
  placeholder = 'Type a keyword…'
}: KeywordTagsFieldProps) {
  const [draft, setDraft] = useState('')

  const commit = (raw: string) => {
    const tag = raw.trim()
    setDraft('')
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
  }

  const remove = (tag: string) => {
    onChange(value.filter((item) => item !== tag))
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <span className="badge badge-sm gap-1 pr-1">
                {tag}
                {disabled ? null : (
                  <button
                    type="button"
                    aria-label={`Remove ${tag}`}
                    className="btn btn-ghost btn-circle btn-xs text-base-content/70 hover:text-base-content"
                    onClick={() => remove(tag)}>
                    <Icons.close size={12} aria-hidden />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <TextInput
        id="docKeywords"
        label="Keywords"
        labelPosition="above"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft.trim()) commit(draft)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            commit(draft)
            return
          }
          if (event.key === 'Backspace' && draft.length === 0 && value.length > 0) {
            event.preventDefault()
            remove(value[value.length - 1])
          }
        }}
      />
    </div>
  )
}
