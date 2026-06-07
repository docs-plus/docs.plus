import { type CSSProperties, useEffect, useState } from 'react'
import { LuLink } from 'react-icons/lu'

import { type IconComponent, loadIconForDomain } from '../utils/socialIcons'

interface SocialIconProps {
  domain: string
  size?: number
  className?: string
  style?: CSSProperties
}

const SocialIcon = ({ domain, size = 16, className, style }: SocialIconProps) => {
  const [Icon, setIcon] = useState<IconComponent | null>(null)

  useEffect(() => {
    let cancelled = false
    loadIconForDomain(domain).then((C) => {
      // Updater form required: setIcon(C) would let React invoke C as a
      // reducer instead of storing the component.
      if (!cancelled) setIcon(() => C)
    })
    return () => {
      cancelled = true
    }
  }, [domain])

  if (!Icon) return <LuLink size={size} className={className} style={style} />
  return <Icon size={size} className={className} style={style} />
}

export default SocialIcon
