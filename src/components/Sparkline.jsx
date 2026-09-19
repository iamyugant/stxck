import { useId } from 'react'

// Values from `splitAt` onward are drawn dashed, as a projection.
export default function Sparkline({ values, width = 76, height = 34, color, area = false, strokeWidth = 1.2, splitAt }) {
  const id = useId()
  if (!values?.length) return <svg width={width} height={height} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const pts = values.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 4)])
  const toPath = (arr, move = true) => arr.map(([x, y], i) => `${i === 0 && move ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const cut = splitAt && splitAt < pts.length ? splitAt : pts.length
  const solid = toPath(pts.slice(0, cut))
  const dashed = cut < pts.length ? toPath(pts.slice(cut - 1)) : null
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      {area && (
        <>
          <defs>
            <pattern id={`hatch${id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke={color} strokeOpacity="0.22" strokeWidth="1" />
            </pattern>
          </defs>
          <path d={`${solid}L${pts[cut - 1][0]},${height}L0,${height}Z`} fill={`url(#hatch${id})`} />
        </>
      )}
      <path d={solid} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {dashed && <path d={dashed} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray="3 3" strokeOpacity="0.8" />}
      {dashed && <circle cx={pts[cut - 1][0]} cy={pts[cut - 1][1]} r="2.2" fill={color} />}
    </svg>
  )
}
