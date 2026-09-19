const ET = 'America/New_York'

export function fmt(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export const fmtSigned = (n, digits = 2) => (n >= 0 ? '+' : '-') + fmt(Math.abs(n), digits)
export const fmtPct = (n, digits = 2) => fmtSigned(n, digits) + '%'

export function fmtCompact(n) {
  if (n == null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return fmt(n / 1e12, 2) + 'T'
  if (abs >= 1e9) return fmt(n / 1e9, 2) + 'B'
  if (abs >= 1e6) return Math.round(n / 1e6) + 'M'
  if (abs >= 1e3) return fmt(n / 1e3, 1) + 'K'
  return fmt(n, 0)
}

export function fmtTimeET(ms, withSeconds = false) {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    timeZone: ET,
  })
}

export function tzAbbrET(ms) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: ET, timeZoneName: 'short' })
    .formatToParts(new Date(ms))
    .find((p) => p.type === 'timeZoneName')
  return part ? part.value : 'ET'
}

export function fmtTick(ms, tf) {
  const d = new Date(ms)
  switch (tf) {
    case '1D':
      // "5 AM" rather than "5:00 AM" — axis labels are always on the hour.
      return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: ET })
    case '5D':
      return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', timeZone: ET })
    case '1M':
    case '6M':
    case 'YTD':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: ET })
    case '1Y':
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: ET })
    default:
      return d.toLocaleDateString('en-US', { year: 'numeric', timeZone: ET })
  }
}

export function fmtTooltipTime(ms, tf) {
  const d = new Date(ms)
  if (tf === '1D') return fmtTimeET(ms)
  if (tf === '5D')
    return d.toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: ET,
    })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: ET })
}
