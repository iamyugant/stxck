import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt, fmtTick, fmtTooltipTime } from '../../lib/format.js'

const HOUR = 3600e3

function computeTicks(points, tf) {
  const t0 = points[0].t
  const t1 = points[points.length - 1].t
  if (tf === '1D') {
    const step = t1 - t0 > 13 * HOUR ? 3 * HOUR : 2 * HOUR
    const out = []
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) out.push(t)
    return out
  }
  if (tf === '5D') {
    const seen = new Set()
    const out = []
    for (const p of points) {
      const key = new Date(p.t).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
      if (!seen.has(key)) {
        seen.add(key)
        out.push(p.t)
      }
    }
    return out
  }
  const n = 6
  return Array.from({ length: n }, (_, i) => points[Math.round((i / (n - 1)) * (points.length - 1))].t)
}

function EdgeTick({ x, y, payload, index, visibleTicksCount, tf }) {
  const anchor = index === 0 ? 'start' : index === visibleTicksCount - 1 ? 'end' : 'middle'
  return (
    <text x={x} y={y + 14} textAnchor={anchor} className="axis-tick">
      {fmtTick(payload.value, tf)}
    </text>
  )
}

function LastPill({ cx, cy, value }) {
  if (cx == null || cy == null) return null
  const label = fmt(value)
  const w = label.length * 6.4 + 16
  return (
    <g className="last-pill">
      <rect x={cx + 8} y={cy - 11} width={w} height={22} rx={5} fill="#f5f7fa" />
      <text x={cx + 8 + w / 2} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0b111d" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font)' }}>
        {label}
      </text>
    </g>
  )
}

function ChartTip({ active, payload, tf, base }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const diff = ((p.v - base) / base) * 100
  return (
    <div className="chart-tip">
      <span className="chart-tip__price">{fmt(p.v)}</span>
      <span className={diff >= 0 ? 'is-up' : 'is-down'}>
        {diff >= 0 ? '+' : ''}
        {fmt(diff)}%
      </span>
      <span className="chart-tip__time">{fmtTooltipTime(p.t, tf)}</span>
    </div>
  )
}

export default function PriceChart({ points, base, tf, height = 210 }) {
  const boxRef = useRef(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 460))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const gid = 'pc' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const { min, max, off, domain, ticks, last } = useMemo(() => {
    const vals = points.map((p) => p.v)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const off = max === min ? 1 : Math.min(1, Math.max(0, (max - base) / (max - min)))
    const lo = Math.min(min, base)
    const hi = Math.max(max, base)
    const pad = (hi - lo) * 0.14 || 1
    return {
      min,
      max,
      off,
      domain: [lo - pad, hi + pad],
      ticks: computeTicks(points, tf).filter((_, i, all) => !narrow || all.length <= 4 || i % 2 === 0),
      last: points[points.length - 1],
    }
  }, [points, base, tf, narrow])

  return (
    <div className="price-chart" style={{ height }} ref={boxRef}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 62, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset={off} stopColor="var(--up)" />
              <stop offset={off} stopColor="var(--down)" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={(props) => <EdgeTick {...props} tf={tf} />}
            height={28}
          />
          <YAxis hide domain={domain} />
          <ReferenceLine y={base} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 4" />
          <Tooltip
            content={<ChartTip tf={tf} base={base} />}
            cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Line
            key={`${tf}-${points.length}-${min}-${max}`}
            dataKey="v"
            stroke={`url(#${gid})`}
            strokeWidth={1.6}
            dot={false}
            activeDot={{ r: 4, fill: '#f5f7fa', stroke: 'var(--bg)', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={1100}
            animationEasing="ease-out"
          />
          <ReferenceDot x={last.t} y={last.v} r={0} shape={(p) => <LastPill {...p} value={last.v} />} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
