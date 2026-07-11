import { initials } from '../lib/format'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'small' | 'medium' | 'large'
}

export function Avatar({ name, src, size = 'medium' }: AvatarProps) {
  if (src) {
    return <img className={`avatar avatar--${size}`} src={src} alt="" />
  }

  return (
    <span className={`avatar avatar--${size} avatar--fallback`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
