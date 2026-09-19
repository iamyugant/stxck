import { chart, seriesStats } from './yahoo.js'

const Z10 = -1.2816
const Z90 = 1.2816

/**
 * Backtest a lump sum over the last `years`, then project a lognormal
 * 10th/50th/90th percentile band over the same horizon from realized drift/vol.
 */
export async function simulate({ symbol, amount, years }) {
  const tf = years <= 1 ? '1Y' : years <= 5 ? '5Y' : 'All'
  const { meta, points: all } = await chart(symbol, tf)
  const cutoff = all[all.length - 1].t - years * 365.25 * 86400e3
  const points = all.filter((p) => p.t >= cutoff)
  if (points.length < 6) throw new Error(`Not enough history for ${symbol} over ${years} years`)

  const start = points[0].v
  const shares = amount / start
  const path = points.map((p) => ({ t: p.t, v: +(p.v * shares).toFixed(2) }))
  const final = path[path.length - 1].v
  const actualYears = (points[points.length - 1].t - points[0].t) / (365.25 * 86400e3)
  const stats = seriesStats(points)
  const cagr = (Math.pow(final / amount, 1 / Math.max(actualYears, 0.1)) - 1) * 100

  // Clamp drift so a meteoric backtest doesn't project fantasy numbers.
  const sigma = Math.max(0.05, stats.annualizedVolatilityPct / 100)
  const mu = Math.min(0.25, Math.max(-0.1, Math.log(1 + cagr / 100)))
  const projection = []
  const now = path[path.length - 1].t
  for (let y = 0; y <= years; y++) {
    const drift = (mu - (sigma * sigma) / 2) * y
    const spread = sigma * Math.sqrt(y)
    projection.push({
      t: now + y * 365.25 * 86400e3,
      bear: +(final * Math.exp(drift + Z10 * spread)).toFixed(2),
      base: +(final * Math.exp(drift)).toFixed(2),
      bull: +(final * Math.exp(drift + Z90 * spread)).toFixed(2),
    })
  }
  const end = projection[projection.length - 1]

  return {
    symbol: meta.symbol,
    name: meta.longName || meta.shortName || symbol,
    amount,
    years,
    shares: +shares.toFixed(4),
    startDate: new Date(points[0].t).toISOString().slice(0, 10),
    startPrice: +start.toFixed(2),
    currentPrice: +points[points.length - 1].v.toFixed(2),
    finalValue: final,
    totalReturnPct: +(((final - amount) / amount) * 100).toFixed(2),
    cagrPct: +cagr.toFixed(2),
    maxDrawdownPct: +stats.maxDrawdownPct.toFixed(2),
    volatilityPct: +stats.annualizedVolatilityPct.toFixed(2),
    projectedBear: end.bear,
    projectedBase: end.base,
    projectedBull: end.bull,
    path,
    projection,
  }
}
