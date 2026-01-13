type TProps = {
  className?: string
  size?: number
  repeat?: number
}

const AvatarStackLoader = ({ className = '', size = 9, repeat = 2 }: TProps) => {
  const sizeClass = `size-${size}`

  return (
    <div className={`avatar-group -space-x-4 ${className}`}>
      {Array.from({ length: repeat }).map((_, index) => (
        <div className="avatar" key={index}>
          <div className={`skeleton ${sizeClass} rounded-full`} />
        </div>
      ))}
    </div>
  )
}

export default AvatarStackLoader
