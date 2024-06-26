import { useState, useCallback, useEffect } from 'react'
import InputOverlapLabel from './InputOverlapLabel'

const InputTags = ({ label, onChangeTags, defaultTags, placeholder }) => {
  const [input, setInput] = useState('')
  const [tags, setTags] = useState(defaultTags || [])
  const [isKeyReleased, setIsKeyReleased] = useState(true)

  const onKeyDown = useCallback(
    (e) => {
      const { key } = e
      const trimmedInput = input.trim()

      if (key === ',' || (key === 'Enter' && trimmedInput.length && !tags.includes(trimmedInput))) {
        e.preventDefault()
        setTags((prevState) => {
          const newTags = [...prevState, trimmedInput]
          onChangeTags(newTags)
          return newTags
        })
        setInput('')
      }

      if (key === 'Backspace' && !input.length && tags.length && isKeyReleased) {
        const tagsCopy = [...tags]
        const poppedTag = tagsCopy.pop()
        e.preventDefault()
        setTags(tagsCopy)
        setInput(poppedTag)
      }

      setIsKeyReleased(false)
    },
    [input, tags, isKeyReleased, onChangeTags]
  )

  const onKeyUp = () => {
    setIsKeyReleased(true)
  }

  const onChange = useCallback((e) => {
    const { value } = e.target
    setInput(value)
  }, [])

  const deleteTag = useCallback((index) => {
    setTags((prevState) => {
      const newTags = prevState.filter((tag, i) => i !== index)
      onChangeTags(newTags) // Invoke the passed callback
      return newTags
    })
  }, [])

  useEffect(() => {
    const handleKeyUp = () => setIsKeyReleased(true)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [onChangeTags])

  return (
    <div className="relative flex flex-wrap rounded-md border p-2">
      <div className="absolute left-1 top-2 z-10 origin-[0] -translate-y-4 scale-75 cursor-text bg-white px-2 text-sm text-gray-500 duration-300 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-2 peer-focus:-translate-y-[1.1rem] peer-focus:scale-75 peer-focus:px-2 peer-focus:text-blue-600 dark:bg-gray-900 dark:text-gray-400 peer-focus:dark:text-blue-500">
        {label}
      </div>
      {tags.map((tag, index) => (
        <div
          key={index}
          className="mr-2 mt-2 flex h-9 items-center justify-center rounded-md border px-2 pr-1 align-middle text-sm">
          {tag}
          <button
            className="!ml-2 flex !h-4 !w-4 items-center justify-center rounded-full !bg-indigo-600 align-middle !text-white"
            onClick={() => deleteTag(index)}>
            <span className="text-xs">x</span>
          </button>
        </div>
      ))}
      <InputOverlapLabel
        className="mt-2 h-9 "
        label={placeholder}
        value={input}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onChange={onChange}
      />
    </div>
  )
}

export default InputTags
