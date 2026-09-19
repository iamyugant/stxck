import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import { useDismiss } from '../../lib/hooks.js'

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

const OPTIONS = [
  { id: 'media', icon: 'plusCircle', label: 'Add photos or video', accept: 'image/png,image/jpeg,image/gif,image/webp,video/*' },
  { id: '3d', icon: 'cube', label: 'Add 3D object', accept: '.glb,.gltf,.obj,.usdz,.fbx,.stl' },
  { id: 'files', icon: 'file', label: 'Add files', accept: '.pdf,.csv,.tsv,.txt,.json,.md' },
]

function AttachMenu({ open, onClose, onFiles, anchorRef }) {
  const menuRef = useRef(null)
  const inputRef = useRef(null)
  useDismiss(open, onClose, menuRef, anchorRef)
  useEffect(() => {
    if (open) menuRef.current?.querySelector('button')?.focus()
  }, [open])

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
              <Icon name={o.icon} size={20} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export default function Composer({ onSend, onStop, busy, deep, onDeep, web, onWeb, notify, onCookies, focusKey }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [attachOpen, setAttachOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const areaRef = useRef(null)
  const plusRef = useRef(null)
  const recRef = useRef(null)
  const closeAttach = useCallback(() => setAttachOpen(false), [])

  useLayoutEffect(() => {
    const el = areaRef.current
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [text])

  useEffect(() => {
    areaRef.current?.focus()
  }, [focusKey])

  useEffect(() => () => recRef.current?.abort(), [])

  const hasText = text.trim().length > 0

  const submit = () => {
    if (!hasText || busy) return
    onSend(text.trim(), files)
    setText('')
    setFiles([])
  }

  const toggleVoice = () => {
    if (!SpeechRecognition) {
      notify('Voice input isn\'t supported in this browser')
      return
    }
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'en-US'
    rec.interimResults = true
    const prefix = text ? text.replace(/\s*$/, ' ') : ''
    rec.onresult = (e) => {
      const said = [...e.results].map((r) => r[0].transcript).join('')
      setText(prefix + said)
    }
    rec.onend = () => setListening(false)
    rec.onerror = (e) => {
      setListening(false)
      if (e.error !== 'aborted') notify('Microphone unavailable')
    }
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  return (
    <div className="composer-wrap">
      <div className={`composer ${listening ? 'is-listening' : ''}`}>
        <AttachMenu
          open={attachOpen}
          anchorRef={plusRef}
          onClose={closeAttach}
          onFiles={(list) => setFiles((f) => [...f, ...list])}
        />
        {files.length > 0 && (
          <div className="composer__files">
            {files.map((f, i) => (
              <span className="file-chip" key={f.name + i}>
                <Icon name="paperclip" size={13} />
                <span className="file-chip__name">{f.name}</span>
                <button aria-label={`Remove ${f.name}`} onClick={() => setFiles((all) => all.filter((_, k) => k !== i))}>
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={areaRef}
          className="composer__input"
          rows={2}
          value={text}
          placeholder={listening ? 'Listening…' : 'Ask anything...'}
          aria-label="Ask Stxck anything"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="composer__bar">
          <button
            ref={plusRef}
            className={`comp-btn comp-btn--square ${attachOpen ? 'is-on' : ''}`}
            aria-label="Add attachment"
            aria-expanded={attachOpen}
            onClick={() => setAttachOpen((o) => !o)}
          >
            <Icon name="plus" size={18} />
          </button>
          <button
            className={`comp-btn comp-btn--chip ${deep ? 'is-deep' : ''}`}
            aria-pressed={deep}
            onClick={onDeep}
          >
            <Icon name="atom" size={17} />
            Deep Research
          </button>
          <span className="composer__spacer" />
          <button
            className={`comp-btn comp-btn--square ${web ? 'is-web' : ''}`}
            aria-pressed={web}
            data-tip={web ? 'Web search on' : 'Web search off'}
            aria-label={web ? 'Web search on' : 'Web search off'}
            onClick={onWeb}
          >
            <Icon name="globe" size={18} />
          </button>
          <button
            className={`comp-btn comp-btn--square ${listening ? 'is-rec' : ''}`}
            aria-label={listening ? 'Stop dictation' : 'Dictate'}
            onClick={toggleVoice}
          >
            <Icon name="mic" size={18} />
          </button>
          {busy ? (
            <button className="send-btn has-text is-stop" aria-label="Stop generating" onClick={onStop}>
              <span className="send-btn__icon send-btn__icon--send">
                <Icon name="stop" size={16} />
              </span>
            </button>
          ) : (
            <button
              className={`send-btn ${hasText ? 'has-text' : ''}`}
              aria-label={hasText ? 'Send message' : 'Voice input'}
              onClick={hasText ? submit : toggleVoice}
            >
              <span className="send-btn__icon send-btn__icon--wave">
                <Icon name="wave" size={18} weight="bold" />
              </span>
              <span className="send-btn__icon send-btn__icon--send">
                <Icon name="send" size={18} weight="bold" />
              </span>
            </button>
          )}
        </div>
      </div>
      <p className="disclaimer">
        Stxck can make mistakes, check important information. See{' '}
        <button className="link" onClick={onCookies}>
          Cookie Preferences
        </button>
        .
      </p>
    </div>
  )
}
