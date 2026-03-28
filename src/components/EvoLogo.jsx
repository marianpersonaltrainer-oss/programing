import { useState } from 'react'

const LOGO_SRC = '/brand/Ppal.png'

export default function EvoLogo({ className = '', imgClassName = 'h-9 w-auto object-contain' }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-10 w-10 rounded-xl bg-[#6A1F6D] flex items-center justify-center text-[#FFFF4C] font-black text-lg font-evo-display">
          E
        </div>
      </div>
    )
  }

  return (
    <img
      src={LOGO_SRC}
      alt="EVO Evolution"
      className={`${imgClassName} ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
