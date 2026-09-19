// US equity market session in New York time, including NYSE full-day holidays.
const ET = 'America/New_York'

const HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
])

const PRE = 4 * 60
const OPEN = 9 * 60 + 30
const CLOSE = 16 * 60
const AFTER = 20 * 60

function etParts(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  )
  return { ymd: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) }
}

const isTradingDay = ({ ymd, weekday }) => weekday !== 'Sat' && weekday !== 'Sun' && !HOLIDAYS.has(ymd)

function span(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

/** Next regular open as a short label, e.g. "Mon 9:30 AM". */
function nextOpen(date) {
  for (let d = 1; d <= 10; d++) {
    const probe = new Date(date.getTime() + d * 86400e3)
    const parts = etParts(probe)
    if (isTradingDay(parts)) return `${d === 1 ? 'tomorrow' : parts.weekday} 9:30 AM`
  }
  return 'soon'
}

/**
 * { state: 'pre' | 'open' | 'after' | 'closed', label, detail }
 */
export function marketStatus(date = new Date()) {
  const parts = etParts(date)
  const m = parts.minutes
  if (!isTradingDay(parts)) {
    return { state: 'closed', label: HOLIDAYS.has(parts.ymd) ? 'Market holiday' : 'Market closed', detail: `Opens ${nextOpen(date)} ET` }
  }
  if (m >= OPEN && m < CLOSE) return { state: 'open', label: 'Market open', detail: `Closes in ${span(CLOSE - m)}` }
  if (m >= PRE && m < OPEN) return { state: 'pre', label: 'Pre-market', detail: `Opens in ${span(OPEN - m)}` }
  if (m >= CLOSE && m < AFTER) return { state: 'after', label: 'After hours', detail: `Ends in ${span(AFTER - m)}` }
  return { state: 'closed', label: 'Market closed', detail: m < PRE ? 'Opens 9:30 AM ET' : `Opens ${nextOpen(date)} ET` }
}
