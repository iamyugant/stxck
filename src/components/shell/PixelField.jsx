import { useEffect, useRef } from 'react'

// Twinkling square "data dust" that fades up from the bottom edge.
export default function PixelField({ className = '', cell = 9, intensity = 1 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let cells = []
    let raf = 0
    let last = 0

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cells = []
      const cols = Math.ceil(w / cell)
      const rows = Math.ceil(h / cell)
      for (let r = 0; r < rows; r++) {
        const depth = r / rows // 0 top → 1 bottom
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.2 + depth * 0.55) continue
          cells.push({
            x: c * cell,
            y: r * cell,
            a: Math.random() * depth * depth * 0.55 * intensity,
            p: Math.random() * Math.PI * 2,
            s: 0.4 + Math.random() * 1.4,
            big: Math.random() < 0.12,
          })
        }
      }
    }

    const draw = (t) => {
      if (t - last > 90 || reduce) {
        last = t
        ctx.clearRect(0, 0, w, h)
        for (const d of cells) {
          const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(t * 0.0012 * d.s + d.p)
          ctx.fillStyle = `rgba(0, 211, 243, ${d.a * tw})`
          const size = d.big ? 4 : 2.5
          ctx.fillRect(d.x, d.y, size, size)
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }

    build()
    raf = requestAnimationFrame(draw)
    const ro = new ResizeObserver(() => {
      build()
      if (reduce) draw(0)
    })
    ro.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [cell, intensity])

  return <canvas ref={ref} className={`pixel-field ${className}`} aria-hidden="true" />
}
