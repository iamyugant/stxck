// Pure paper-trading rules, shared by the UI hook and tests.
import { fmt } from './format.js'

export const STARTING_CASH = 100000

export const freshPortfolio = () => ({ cash: STARTING_CASH, positions: {}, trades: [], createdAt: Date.now() })

/**
 * Apply a market order to a portfolio. Returns { ok, portfolio } or { ok: false, error }.
 * Buys average into the cost basis; sells realize P&L against it.
 */
export function applyTrade(p, { symbol, side, quantity, price }, now = Date.now(), id = `t_${now.toString(36)}`) {
  const qty = Number(quantity)
  if (!symbol || !(qty > 0) || !(price > 0)) return { ok: false, error: 'Enter a valid quantity' }
  const cost = qty * price
  const pos = p.positions[symbol] || { quantity: 0, avgCost: 0 }
  if (side === 'buy') {
    if (cost > p.cash + 1e-6) return { ok: false, error: `Not enough buying power (need $${fmt(cost)}, have $${fmt(p.cash)})` }
    const q = pos.quantity + qty
    return {
      ok: true,
      portfolio: {
        ...p,
        cash: p.cash - cost,
        positions: { ...p.positions, [symbol]: { quantity: q, avgCost: (pos.quantity * pos.avgCost + cost) / q, openedAt: pos.openedAt || now } },
        trades: [{ id, symbol, side, quantity: qty, price, time: now }, ...p.trades].slice(0, 500),
      },
    }
  }
  if (side !== 'sell') return { ok: false, error: 'Unknown order side' }
  if (qty > pos.quantity + 1e-9) return { ok: false, error: `You hold ${+pos.quantity.toFixed(4)} ${symbol}` }
  const remaining = pos.quantity - qty
  const positions = { ...p.positions }
  if (remaining < 1e-9) delete positions[symbol]
  else positions[symbol] = { ...pos, quantity: remaining }
  return {
    ok: true,
    portfolio: {
      ...p,
      cash: p.cash + cost,
      positions,
      trades: [{ id, symbol, side, quantity: qty, price, time: now, realized: (price - pos.avgCost) * qty }, ...p.trades].slice(0, 500),
    },
  }
}
