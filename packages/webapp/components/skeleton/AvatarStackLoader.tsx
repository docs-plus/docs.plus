type TProps = {
  className?: string
  size?: number
  repeat?: number
}

const AvatarStackLoader = ({ className, size = 8, repeat = 2 }: TProps) => {
  return (
    <div className={`avatar-group -space-x-5 ${className}`}>
      {Array.from({ length: repeat }).map((_, index) => (
        <div className="avatar" key={index}>
          <div className={`skeleton h-${size} w-${size} rounded-full`}></div>
        </div>
      ))}
    </div>
  )
}

export default AvatarStackLoader
