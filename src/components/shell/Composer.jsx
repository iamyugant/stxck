import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import AttachMenu from './AttachMenu.jsx'

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function Composer({ onSend, onStop, busy, deep, onDeep, web, onWeb, notify, onCookies, focusKey }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [attachOpen, setAttachOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const areaRef = useRef(null)
  const plusRef = useRef(null)
  const recRef = useRef(null)

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
          onClose={() => setAttachOpen(false)}
          onFiles={(list) => setFiles((f) => [...f, ...list])}
        />
        {files.length > 0 && (
          <div className="composer__files">
            {files.map((f, i) => (
              <span className="file-chip" key={f.name + i}>
                <Icon name="paperclip" size={13} />
                <span className="file-chip__name">{f.name}</span>
                <button aria-label={`Remove ${f.name}`} onClick={() => setFiles((all) => all.filter((_, k) => k !== i))}>
                  <Icon name="x" size={12} stroke={2} />
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
                <Icon name="stop" size={16} stroke={2} />
              </span>
            </button>
          ) : (
            <button
              className={`send-btn ${hasText ? 'has-text' : ''}`}
              aria-label={hasText ? 'Send message' : 'Voice input'}
              onClick={hasText ? submit : toggleVoice}
            >
              <span className="send-btn__icon send-btn__icon--wave">
                <Icon name="wave" size={18} stroke={2} />
              </span>
              <span className="send-btn__icon send-btn__icon--send">
                <Icon name="send" size={18} stroke={2} />
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
