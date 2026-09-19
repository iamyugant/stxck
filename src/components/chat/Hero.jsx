import { useEffect, useRef } from 'react'
import Icon from '../Icon.jsx'

const PROMPTS = [
  { text: 'Analyze today’s market sentiment', icon: 'bars', tone: 'sky' },
  { text: 'Suggest a better diversification strategy', icon: 'fileSearch', tone: 'yellow' },
  { text: 'Break down a company’s financial health', icon: 'landmark', tone: 'green' },
]

// Rotating wireframe sphere of points with a loose halo.
function GlobeField({ size = 240 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const N = 150
    const pts = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const th = golden * i
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r])
    }
    // Precompute neighbour pairs once (sphere is rigid).
    const pairs = []
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2])
        if (d < 0.36) pairs.push([i, j])
      }
    const halo = Array.from({ length: 170 }, (_, i) => {
      const a = (i / 170) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.6
      const rr = 0.62 + Math.abs(Math.sin(i * 78.233)) * 0.36
      return { a, rr, s: 0.4 + Math.abs(Math.sin(i * 3.1)) * 0.9, sp: 0.00006 + (i % 7) * 0.00002 }
    })

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cx = size / 2
    const cy = size / 2
    const R = size * 0.25
    let raf = 0
    const draw = (t) => {
      ctx.clearRect(0, 0, size, size)
      const rot = reduce ? 0.6 : t * 0.00018
      const tilt = 0.35
      const proj = pts.map(([x, y, z]) => {
        const x1 = x * Math.cos(rot) - z * Math.sin(rot)
        const z1 = x * Math.sin(rot) + z * Math.cos(rot)
        const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt)
        const z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt)
        return [cx + x1 * R, cy + y2 * R, z2]
      })
      ctx.lineWidth = 0.5
      for (const [i, j] of pairs) {
        const depth = (proj[i][2] + proj[j][2]) / 2
        ctx.strokeStyle = `rgba(210,230,240,${0.05 + (depth + 1) * 0.1})`
        ctx.beginPath()
        ctx.moveTo(proj[i][0], proj[i][1])
        ctx.lineTo(proj[j][0], proj[j][1])
        ctx.stroke()
      }
      for (const [x, y, z] of proj) {
        ctx.fillStyle = `rgba(230,240,248,${0.25 + (z + 1) * 0.3})`
        ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4)
      }
      for (const h of halo) {
        const a = h.a + (reduce ? 0 : t * h.sp)
        const x = cx + Math.cos(a) * h.rr * size * 0.5
        const y = cy + Math.sin(a) * h.rr * size * 0.5
        ctx.fillStyle = `rgba(200,220,235,${0.1 + (1 - h.rr) * 0.5})`
        ctx.fillRect(x, y, h.s, h.s)
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return <canvas ref={ref} className="globe" style={{ width: size, height: size }} aria-hidden="true" />
}

export default function Hero({ onPrompt }) {
  return (
    <section className="hero">
      <GlobeField size={250} />
      <h1 className="hero__title">
        Your stock analyst,
        <br />
        <span className="dim">powered by Stxck.</span>
      </h1>
      <p className="hero__sub">Stxck turns every question into actionable stock insights</p>
      <div className="prompt-cards">
        {PROMPTS.map((p, i) => (
          <button
            key={p.text}
            className={`prompt-card prompt-card--${p.tone}`}
            style={{ animationDelay: `${120 + i * 70}ms` }}
            onClick={() => onPrompt(p.text)}
          >
            <span className="prompt-card__text">{p.text}</span>
            <Icon name={p.icon} size={20} className="prompt-card__icon" />
          </button>
        ))}
      </div>
    </section>
  )
}
