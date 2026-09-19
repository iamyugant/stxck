// Stxck mark geometry (200×200 box): a stepped bar chart of stacked blocks with a
// detached "breakout" block above the tallest column. Shared by the logo and the loader.
const C = 48
const G = 10
const X0 = 18
const Y0 = 200 - 18 - C
const RADIUS = 9

const at = (col, row, dx = 0, dy = 0) => ({ x: X0 + col * (C + G) + dx, y: Y0 - row * (C + G) - dy, s: C })

// Order matters: the loader lights blocks bottom-left → breakout.
const BLOCKS = [
  { ...at(0, 0), tone: 'yellow' },
  { ...at(1, 0), tone: 'yellow' },
  { ...at(1, 1), tone: 'yellow' },
  { ...at(2, 0), tone: 'yellow' },
  { ...at(2, 1), tone: 'yellow' },
  { ...at(2, 2, 8, 10), tone: 'sky' },
]

export function StxckLogo({ size = 32, mono = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Stxck" role="img" className="stxck-logo">
      {BLOCKS.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.s} height={b.s} rx={RADIUS} fill={mono || b.tone === 'yellow' ? 'var(--yellow)' : 'var(--sky)'} />
      ))}
    </svg>
  )
}

export function LogoLoader({ size = 20, label, still = false }) {
  return (
    <span className={`logo-loader ${still ? 'is-still' : ''}`} role={label ? 'status' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
        {BLOCKS.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.s}
            height={b.s}
            rx={RADIUS}
            className={b.tone === 'sky' ? 'is-sky' : ''}
            style={{ animationDelay: `${i * 110}ms` }}
          />
        ))}
      </svg>
    </span>
  )
}

function Google() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

function Amazon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <text x="12" y="15.5" textAnchor="middle" fontSize="17" fontWeight="700" fill="#FF9900" fontFamily="Arial, sans-serif">a</text>
      <path d="M5 17.5c4.2 2.6 9.8 2.6 13.4.2" stroke="#FF9900" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M16.2 16.6l2.3 1-.6 2.3" stroke="#FF9900" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Nvidia() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M2 12c3-4.6 7-6.4 11-6.3 3.6.1 6.7 1.9 9 4.3v4c-2.3 2.4-5.4 4.2-9 4.3-4 .1-8-1.7-11-6.3z" fill="none" stroke="#76B900" strokeWidth="1.8" />
      <path d="M6.5 12c2-2.6 4.4-3.6 6.6-3.5 2 .1 3.6 1.1 4.7 2.3-1.3 1.8-3.1 3.1-5.2 3.2-2.3.1-4.2-.7-6.1-2z" fill="#76B900" />
      <circle cx="12.8" cy="11.6" r="1.6" fill="#111827" />
    </svg>
  )
}

function Apple() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17">
      <path
        fill="#fff"
        d="M16.37 12.64c-.03-2.6 2.13-3.86 2.22-3.92-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.95-3.94.95-.82 0-2.07-.93-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.15-.47 7.81 1.3 10.37.87 1.25 1.9 2.65 3.25 2.6 1.3-.05 1.8-.84 3.37-.84 1.58 0 2.02.84 3.4.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.05-2.74-4.15zM13.8 5.01c.71-.87 1.2-2.07 1.07-3.27-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.09 3.18 1.15.09 2.33-.58 3.04-1.46z"
      />
    </svg>
  )
}

function Monogram({ symbol, label }) {
  const hue = [...symbol].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  return (
    <span className={`logo-mono ${label ? 'logo-mono--long' : ''}`} style={{ '--hue': hue }}>
      {label || symbol.replace('^', '').charAt(0)}
    </span>
  )
}

const MARKS = {
  GOOG: Google,
  GOOGL: Google,
  AMZN: Amazon,
  NVDA: Nvidia,
  AAPL: Apple,
}

export function CompanyLogo({ symbol, size = 36 }) {
  const Mark = MARKS[symbol]
  const index = { '^GSPC': 'S&P', '^IXIC': 'NDQ', '^DJI': 'DJI' }[symbol]
  return (
    <span className="company-logo" style={{ width: size, height: size }}>
      {Mark ? <Mark /> : <Monogram symbol={symbol} label={index} />}
    </span>
  )
}
