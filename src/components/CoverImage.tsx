import { useState } from 'react'

interface Props {
  src: string
  alt?: string
  className?: string
}

/** Lazy image with a graceful fallback: renders nothing if the file fails to load. */
export default function CoverImage({ src, alt = '', className }: Props) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
