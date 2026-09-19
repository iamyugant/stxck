import { useEffect, useRef } from 'react'
import Icon from '../Icon.jsx'

const OPTIONS = [
  { id: 'media', icon: 'plusCircle', label: 'Add photos or video', accept: 'image/png,image/jpeg,image/gif,image/webp,video/*' },
  { id: '3d', icon: 'cube', label: 'Add 3D object', accept: '.glb,.gltf,.obj,.usdz,.fbx,.stl' },
  { id: 'files', icon: 'file', label: 'Add files', accept: '.pdf,.csv,.tsv,.txt,.json,.md' },
]

export default function AttachMenu({ open, onClose, onFiles, anchorRef }) {
  const menuRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return
      onClose()
    }
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    menuRef.current?.querySelector('button')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  const pick = (accept) => {
    const input = inputRef.current
    input.accept = accept
    input.value = ''
    input.click()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = [...e.target.files]
          if (files.length) onFiles(files)
          onClose()
        }}
      />
      {open && (
        <div className="attach-menu" ref={menuRef} role="menu">
          {OPTIONS.map((o) => (
            <button key={o.id} role="menuitem" className="attach-menu__item" onClick={() => pick(o.accept)}>
              <Icon name={o.icon} size={20} stroke={1.4} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
