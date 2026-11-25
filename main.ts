// Tiny Bot — RSI(14) mean reversion on Solana hourly bars.
// Competition: u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1 ("Tiny Bot, Easy $2").
// Strategy, per symbol independently, evaluated on the dev window:
//   - Buy 20% of equity when RSI(14) < 25 (oversold bounce).
//   - Sell the whole position when RSI(14) > 55.
//   - Long only, no leverage, no shorts. Deterministic: no clock, no random,
//     float64 arithmetic only, so two runs produce identical action logs.
// Cash-contention fix: same-bar buys are sized against the cash that is
// actually left after the buys already decided in this reply (sells never
// fund same-bar buys — their proceeds land at the next open), so a bar
// where several symbols trigger at once cannot over-commit cash.
// RSI is the rolling-window form: average gain and average loss are the
// means of the up / down moves over the last 14 closes' changes, recomputed
// on every bar. RSI = 100 * gain / (gain + loss), 50 when nothing moved.
// A symbol needs 15 closes before its first RSI.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const RSI_PERIOD = 14;
const BUY_BELOW = 25;
const SELL_ABOVE = 55;
/** 20% of equity per buy, in basis points. */
const BUY_WEIGHT_BPS = 2000;
/** Wide slippage cap: fills are at the next bar's open, so the cap only
 *  guards against a liquidity gap, it should almost never bind. */
const MAX_SLIPPAGE_BPS = 10000;

interface RsiSeries {
  /** Last close seen, null before the first bar. */
  last: number | null;
  /** The last RSI_PERIOD closes' changes, oldest first. */
  changes: number[];
}

const series = new Map<string, RsiSeries>();

function pushClose(bar: Bar): void {
  let s = series.get(bar.symbol);
  if (s === undefined) {
    s = { last: null, changes: [] };
    series.set(bar.symbol, s);
  }
  const close = Number(bar.c);
  if (s.last !== null) {
    s.changes.push(close - s.last);
    if (s.changes.length > RSI_PERIOD) s.changes.shift();
  }
  s.last = close;
}

function rsi(s: RsiSeries): number | null {
  if (s.changes.length < RSI_PERIOD) return null;
  let gain = 0;
  let loss = 0;
  for (const d of s.changes) {
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= RSI_PERIOD;
  loss /= RSI_PERIOD;
  const moved = gain + loss;
  return moved === 0 ? 50 : (100 * gain) / moved;
}

await runBars({
  onBatch(state: BarsState, batch) {
    for (const bar of batch.bars) pushClose(bar);
    if (state.warmingUp) return [];
    const fresh = new Set(batch.bars.map((b) => b.symbol));
    const { caps, fees } = state.hello;
    const minNotional = BigInt(fees.min_notional_quote_units);

    const sells: SellInput[] = [];
    const buys: BuyInput[] = [];
    // Sells first: a sell decided now fills at the next open and its
    // proceeds never fund a buy in this same reply.
    for (const { symbol } of state.hello.symbols) {
      if (!fresh.has(symbol)) continue;
      const held = state.positions.get(symbol);
      if (held === undefined) continue;
      const s = series.get(symbol);
      const r = s === undefined ? null : rsi(s);
      if (r !== null && r > SELL_ABOVE) {
        sells.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
    }

    // Buys: 20% of equity per symbol, capped by the 25% weight cap and by
    // the cash still unspent in this reply. Symbols are considered in
    // universe order, so when cash runs short the earlier symbols keep
    // their full size and later ones shrink or wait for the next bar.
    const target = (BigInt(BUY_WEIGHT_BPS) * state.equity) / BPS;
    const weightCap = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    let cashLeft = state.cash;
    let openCount = state.positions.size;
    for (const { symbol } of state.hello.symbols) {
      if (!fresh.has(symbol)) continue;
      if (state.positions.get(symbol) !== undefined) continue;
      if (openCount >= caps.max_open_positions) break;
      if (sells.length + buys.length >= caps.max_orders_per_bar) break;
      const s = series.get(symbol);
      const r = s === undefined ? null : rsi(s);
      if (r === null || r >= BUY_BELOW) continue;
      let size = target < weightCap ? target : weightCap;
      if (size > cashLeft) size = cashLeft;
      // Once the cash left cannot fund even one minimum buy, no later
      // symbol can either (every buy is capped by the same cashLeft).
      if (size < minNotional) break;
      buys.push({ side: 'buy', symbol, notional_quote_units: size, max_slippage_bps: MAX_SLIPPAGE_BPS });
      cashLeft -= size;
      openCount += 1;
    }

    return [...sells, ...buys].slice(0, caps.max_orders_per_bar);
  },
});
