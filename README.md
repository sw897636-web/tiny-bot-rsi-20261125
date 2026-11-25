# Tiny Bot — RSI(14) Mean Reversion on Solana

[![make.fun](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![Rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/sw897636-web/tiny-bot-rsi-20261125/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![Reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/sw897636-web/tiny-bot-rsi-20261125/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

Entry for the make.fun competition **"Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana"**
(`u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1`).

## Strategy

RSI(14) mean reversion, per symbol independently, on 7 Solana symbols
(FARTCOIN, JITOSOL, POPCAT, RAY, SOL, WETH, WIF), hourly bars, $10,000 USDC:

- **Buy** 20% of equity when RSI(14) < 25 (oversold).
- **Sell** the whole position when RSI(14) > 55.
- Long only, no leverage, no shorts. Fully deterministic (no clock, no random).

Same-bar buys are sized against the cash actually left in the reply, so
several symbols triggering on one bar cannot over-commit cash.

## Local grade (dev window, `grade-local --driver process`)

| metric | value |
|---|---|
| Net PnL | +$487.41 (+4.87%) |
| Trades | 30 |
| Max drawdown | 1.76% |
| Fees | $62.17 |

Beats hold-cash ($0.00) by +$487 and buy-and-hold (-$869.34) by +$1,357 on dev.
Scoring is on the final window (2026-11-27 → 2026-11-30 UTC), collected after
the deadline — dev outperformance is evidence, not a guarantee.

## Layout

- `main.ts` — the bot (Node 22, TypeScript, speaks `agent-fun/bars-replay/v1`).
- `vendor/makefun-bars.ts` — the kit's protocol shim, vendored unchanged.

## License

MIT — see [LICENSE](LICENSE).
