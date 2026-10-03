import type { Candle, Timeframe } from "@gorengan/shared";
import { analyzeCandles, cleanCandles } from "./analysis";

export function marketSignals(raw: Candle[], symbol: string, timeframe: Timeframe, now: number) {
  const candles = cleanCandles(raw, symbol, timeframe).filter((c) => c.closeTime <= now && c.openTime < c.closeTime);
  const analysis = analyzeCandles(candles);
  if (!analysis) return null;
  const previous = candles.slice(-21, -1);
  const volumes = previous.map((c) => c.volume);
  const volumeValid = [...volumes, analysis.last.volume].every((v) => Number.isFinite(v) && v >= 0);
  const mean = volumes.reduce((sum, v) => sum + v, 0) / 20;
  const relativeVolume = volumeValid && mean > 0 ? analysis.last.volume / mean : null;
  const priorHigh = Math.max(...previous.map((c) => c.high));
  const priorLow = Math.min(...previous.map((c) => c.low));
  return { ...analysis, relativeVolume, priorHigh, priorLow,
    breakout: analysis.last.close > priorHigh,
    breakdown: analysis.last.close < priorLow,
    volumeConfirmed: relativeVolume !== null && relativeVolume >= 2,
    extended: analysis.rsi >= 70 || (analysis.atr > 0 && analysis.last.close - analysis.fast > 2 * analysis.atr),
  };
}

export interface RiskInput {
  capital: number; riskPercent: number; entry: number; stop: number; target: number;
  feePercent: number; slippagePercent: number; lotSize: number;
}

export function positionPlan(input: RiskInput) {
  const { capital, riskPercent, entry, stop, target, feePercent, slippagePercent, lotSize } = input;
  if (!Object.values(input).every(Number.isFinite) || capital <= 0 || riskPercent <= 0 || riskPercent > 100 || stop <= 0 || stop >= entry || target <= entry || feePercent < 0 || slippagePercent < 0 || feePercent + slippagePercent >= 100 || lotSize <= 0) return null;
  const fee = feePercent / 100;
  const slip = slippagePercent / 100;
  const cost = entry * (1 + slip) * (1 + fee);
  const stopProceeds = stop * (1 - slip) * (1 - fee);
  const targetProceeds = target * (1 - slip) * (1 - fee);
  const riskBudget = capital * riskPercent / 100;
  const quantity = Math.floor(Math.min(riskBudget / (cost - stopProceeds), capital / cost) / lotSize) * lotSize;
  const result = { quantity, lots: quantity / lotSize, riskBudget, capitalUsed: quantity * cost,
    plannedLoss: quantity * (cost - stopProceeds), plannedProfit: quantity * (targetProceeds - cost),
    rewardRisk: (targetProceeds - cost) / (cost - stopProceeds), breakEven: cost / ((1 - slip) * (1 - fee)) };
  return Object.values(result).every(Number.isFinite) ? result : null;
}

export type CryptoRegime =
  | "INSTITUTIONAL_EXPANSION"
  | "SHORT_SQUEEZE_SETUP"
  | "BULLISH_ACCUMULATION"
  | "RANGE_EQUILIBRIUM"
  | "BEARISH_DISTRIBUTION"
  | "LONG_LIQUIDATION_RISK";

export interface InformedFlowAnomaly {
  anomalyScore: number; // 0 - 100
  type: "STEALTH_ACCUMULATION" | "PASSIVE_ABSORPTION" | "DISTRIBUTION_ALERT" | "NORMAL_FLOW";
  typeLabel: string;
  badgeColor: string;
  cvdDivergence: boolean;
  megaTakerCount: number;
  megaTakerBuyVolume: number;
  megaTakerSellVolume: number;
  megaTakerNetVolume: number;
  compressionActive: boolean;
  explanation: string;
  actionableGuidance: string;
}

export interface CryptoIntelComposite {
  compositeScore: number; // 0 - 100
  regime: CryptoRegime;
  regimeLabel: string;
  regimeDesc: string;
  factors: {
    technicalScore: number;   // 0 - 25
    orderFlowScore: number;   // 0 - 25
    microstructureScore: number; // 0 - 25
    derivativesScore: number; // 0 - 25
  };
  leverageMatrix: {
    quadrant: "LONG_EXPANSION" | "SHORT_SQUEEZE" | "SHORT_BUILDING" | "LONG_LIQUIDATION" | "NEUTRAL_FLOW";
    quadrantLabel: string;
    fundingStatus: string;
    oiStatus: string;
    squeezeRisk: "LOW" | "ELEVATED" | "CRITICAL";
  };
  informedFlow: InformedFlowAnomaly;
  actionableThesis: string;
  executionPlan: {
    stance: "BUY_BREAKOUT" | "BUY_PULLBACK" | "HOLD_ACCUMULATE" | "NEUTRAL_STAND_ASIDE" | "CAUTION_DISTRIBUTION" | "HEDGE_SHORT";
    stanceLabel: string;
    invalidationPrice: number;
    takeProfitTarget: number;
    estimatedWinRate: null;
  };
}

export function detectInformedFlowAnomaly(
  signals: ReturnType<typeof marketSignals>,
  flow: import("./cryptoFlow").CryptoFlow | null | undefined,
  isId = false
): InformedFlowAnomaly {
  const trades = flow?.trades;
  const depth = flow?.depth;

  // Count the complete aggregate-trade sample, not just the ten displayed rows.
  const megaTakerBuyVolume = trades?.megaBuyValue ?? 0;
  const megaTakerSellVolume = trades?.megaSellValue ?? 0;
  const megaTakerNetVolume = megaTakerBuyVolume - megaTakerSellVolume;
  const megaTakerCount = trades?.megaCount ?? 0;

  // Volatility compression check (ATR% < 1.6% or price within tight range)
  const compressionActive = Boolean(signals && signals.atrPercent > 0 && signals.atrPercent < 1.6);

  // CVD divergence check: price momentum is flat (<= 0.2%), but CVD is strongly positive (> 150k USDT)
  const momentum = trades && trades.firstPrice > 0 ? (trades.lastPrice / trades.firstPrice - 1) * 100 : null;
  const cvdDivergence = Boolean(trades && trades.cvd > 150000 && momentum !== null && Math.abs(momentum) <= 0.2);

  // Passive absorption: Bid Wall > 1.8x Ask Wall
  const passiveAbsorption = Boolean(depth?.bidWall && depth?.askWall && depth.bidWall.value > depth.askWall.value * 1.8);

  let anomalyScore = 25;
  let type: InformedFlowAnomaly["type"] = "NORMAL_FLOW";

  if (cvdDivergence || (megaTakerCount >= 2 && megaTakerNetVolume > 150000)) {
    type = "STEALTH_ACCUMULATION";
    anomalyScore = Math.min(95, 65 + megaTakerCount * 6 + (compressionActive ? 12 : 0));
  } else if (passiveAbsorption) {
    type = "PASSIVE_ABSORPTION";
    anomalyScore = Math.min(85, 55 + (depth?.top5Imbalance && depth.top5Imbalance > 0 ? 15 : 5));
  } else if (trades && trades.buyRatio < 40 && megaTakerNetVolume < -150000) {
    type = "DISTRIBUTION_ALERT";
    anomalyScore = Math.min(90, 60 + Math.abs(megaTakerCount * 6));
  }

  const typeLabels = isId ? {
    STEALTH_ACCUMULATION: "Ketimpangan beli besar dalam sampel",
    PASSIVE_ABSORPTION: "Ketimpangan order bid",
    DISTRIBUTION_ALERT: "Waspada Distribusi / Exit Dump",
    NORMAL_FLOW: "Tidak ada pemicu heuristik",
  } : {
    STEALTH_ACCUMULATION: "Large-buy sample imbalance",
    PASSIVE_ABSORPTION: "Bid order imbalance",
    DISTRIBUTION_ALERT: "Distribution / Exit Dump Alert",
    NORMAL_FLOW: "No heuristic trigger",
  };

  const badgeColors: Record<InformedFlowAnomaly["type"], string> = {
    STEALTH_ACCUMULATION: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    PASSIVE_ABSORPTION: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
    DISTRIBUTION_ALERT: "text-rose-400 bg-rose-500/15 border-rose-500/30",
    NORMAL_FLOW: "text-zinc-400 bg-zinc-800 border-zinc-700",
  };

  const explanation = isId ? (
    type === "STEALTH_ACCUMULATION"
      ? `Terdeteksi aliran dana agresor senyap: ${megaTakerCount} transaksi mega-taker (≥$100k) dengan net inflow ${megaTakerNetVolume >= 0 ? "+$" : "-$"}${Math.abs(Math.round(megaTakerNetVolume)).toLocaleString()} USDT. ${cvdDivergence ? "Terjadi divergensi CVD (volume beli mendominasi saat pergerakan harga masih tertekan)." : ""} ${compressionActive ? "Harga berada dalam kompresi volatilitas rendah sebelum ekspansi." : ""}`
      : type === "PASSIVE_ABSORPTION"
      ? `Terdeteksi penyerapan pasif: Dinding beli limit ($${Math.round(depth?.bidWall?.value ?? 0).toLocaleString()} USDT pada $${depth?.bidWall?.price.toLocaleString()}) lebih besar dari sisi ask dalam snapshot; order dapat dibatalkan.`
      : type === "DISTRIBUTION_ALERT"
      ? `Terdeteksi tekanan jual agresor berskala besar: Taker sell mendominasi dengan net outflow -$${Math.round(Math.abs(megaTakerNetVolume)).toLocaleString()} USDT.`
      : "Tidak ada pemicu heuristik pada sampel ini. Identitas dan pengetahuan pelaku tidak dapat diketahui."
  ) : (
    type === "STEALTH_ACCUMULATION"
      ? `Stealth aggressor inflow detected: ${megaTakerCount} mega-taker executions (≥$100k) with net inflow ${megaTakerNetVolume >= 0 ? "+$" : "-$"}${Math.abs(Math.round(megaTakerNetVolume)).toLocaleString()} USDT. ${cvdDivergence ? "CVD divergence active (taker buying surging while price remains compressed)." : ""}`
      : type === "PASSIVE_ABSORPTION"
      ? `Passive book absorption active: Heavy limit bid wall ($${Math.round(depth?.bidWall?.value ?? 0).toLocaleString()} USDT at $${depth?.bidWall?.price.toLocaleString()}) exceeds the ask wall in this snapshot; orders can be cancelled.`
      : type === "DISTRIBUTION_ALERT"
      ? `Large taker selling observed: Outflow -$${Math.round(Math.abs(megaTakerNetVolume)).toLocaleString()} USDT hitting market bids.`
      : "No heuristic trigger in this sample. Trader identity and access to information are unknown."
  );

  const actionableGuidance = isId ? (
    type === "STEALTH_ACCUMULATION"
      ? "Pertimbangan: Awasi penembusan batas atas konsolidasi (breakout). Identitas pelaku tidak diketahui; perlu konfirmasi dari sampel berikutnya."
      : type === "PASSIVE_ABSORPTION"
      ? "Pertimbangan: Amati snapshot berikut dan transaksi tereksekusi; dinding order saja belum membuktikan support."
      : type === "DISTRIBUTION_ALERT"
      ? "Pertimbangan: Waspadai pembalikan tajam ke bawah. Pasang stop ketat atau hindari entry buy baru hingga tekanan agresor mereda."
      : "Pertimbangan: Ikuti setup teknikal standar dengan disiplin rasio risiko/hasil."
  ) : (
    type === "STEALTH_ACCUMULATION"
      ? "Action: Monitor consolidation ceiling for breakout expansion. Trader identity is unknown; compare subsequent samples."
      : type === "PASSIVE_ABSORPTION"
      ? "Action: Observe subsequent books and executed trades; a wall alone does not establish support."
      : type === "DISTRIBUTION_ALERT"
      ? "Action: Guard against sudden downside cascade. Tighten stop orders and avoid chasing bids."
      : "Action: Follow standard technical playbook with disciplined risk-reward metrics."
  );

  return {
    anomalyScore,
    type,
    typeLabel: typeLabels[type],
    badgeColor: badgeColors[type],
    cvdDivergence,
    megaTakerCount,
    megaTakerBuyVolume,
    megaTakerSellVolume,
    megaTakerNetVolume,
    compressionActive,
    explanation,
    actionableGuidance,
  };
}

export function computeCryptoIntelComposite(
  signals: ReturnType<typeof marketSignals>,
  flow: import("./cryptoFlow").CryptoFlow | null | undefined,
  etfFlowNetUsd: number | null = null,
  isId = false
): CryptoIntelComposite | null {
  if (!signals || !flow?.depth || !flow.trades || !flow.derivatives || !flow.openInterest) return null;
  if (flow.symbol !== signals.last.symbol || flow.fetchedAt - flow.trades.to > 60000 || flow.fetchedAt - flow.derivatives.time > 120000 || flow.fetchedAt - flow.openInterest.time > 120000) return null;

  const informedFlow = detectInformedFlowAnomaly(signals, flow, isId);

  // Factor 1: Technical & Momentum (0 - 25)
  let technicalScore = 10;
  if (signals.trend === "up") technicalScore += 7;
  else if (signals.trend === "down") technicalScore -= 6;

  if (signals.breakout) technicalScore += 4;
  if (signals.volumeConfirmed) technicalScore += 3;
  if (!signals.extended) technicalScore += 1;
  else technicalScore -= 2;
  technicalScore = Math.max(0, Math.min(25, technicalScore));

  // Factor 2: Order Flow & CVD (0 - 25)
  let orderFlowScore = 12;
  const trades = flow?.trades;
  if (trades) {
    if (trades.buyRatio >= 60) orderFlowScore += 8;
    else if (trades.buyRatio >= 52) orderFlowScore += 4;
    else if (trades.buyRatio <= 40) orderFlowScore -= 6;
    else if (trades.buyRatio <= 48) orderFlowScore -= 3;

    if (trades.whaleNetValue > 0) orderFlowScore += 5;
    else if (trades.whaleNetValue < 0) orderFlowScore -= 4;
  }
  orderFlowScore = Math.max(0, Math.min(25, orderFlowScore));

  // Factor 3: Order Book Microstructure (0 - 25)
  let microstructureScore = 12;
  const depth = flow?.depth;
  if (depth) {
    if (depth.imbalance >= 20) microstructureScore += 7;
    else if (depth.imbalance >= 5) microstructureScore += 4;
    else if (depth.imbalance <= -20) microstructureScore -= 6;
    else if (depth.imbalance <= -5) microstructureScore -= 3;

    if (depth.top5Imbalance >= 15) microstructureScore += 4;
    else if (depth.top5Imbalance <= -15) microstructureScore -= 4;

    if (depth.bidWall && depth.askWall) {
      if (depth.bidWall.value > depth.askWall.value * 1.5) microstructureScore += 2;
      else if (depth.askWall.value > depth.bidWall.value * 1.5) microstructureScore -= 2;
    }
  }
  microstructureScore = Math.max(0, Math.min(25, microstructureScore));

  // Factor 4: Derivatives & Leverage Squeeze (0 - 25)
  let derivativesScore = 12;
  const derivatives = flow?.derivatives;
  const funding = derivatives?.fundingPercent ?? 0.01;
  let quadrant: CryptoIntelComposite["leverageMatrix"]["quadrant"] = "NEUTRAL_FLOW";
  let squeezeRisk: CryptoIntelComposite["leverageMatrix"]["squeezeRisk"] = "LOW";

  // Check for short squeeze potential: negative funding while price is holding/breaking out
  if (funding < -0.005) {
    derivativesScore += 8;
    quadrant = "SHORT_SQUEEZE";
    squeezeRisk = "ELEVATED";
  } else if (funding > 0.035) {
    // Overheated long leverage
    derivativesScore -= 6;
    squeezeRisk = signals.breakdown ? "CRITICAL" : "ELEVATED";
    quadrant = signals.breakdown ? "LONG_LIQUIDATION" : "LONG_EXPANSION";
  } else if (signals.trend === "up") {
    derivativesScore += 5;
    quadrant = "LONG_EXPANSION";
  } else if (signals.trend === "down") {
    derivativesScore -= 4;
    quadrant = "SHORT_BUILDING";
  }
  derivativesScore = Math.max(0, Math.min(25, derivativesScore));

  // Macro ETF bonus (up to +5 or -5)
  let macroBonus = 0;
  if (etfFlowNetUsd != null) {
    if (etfFlowNetUsd > 300) macroBonus = 5;
    else if (etfFlowNetUsd > 0) macroBonus = 2;
    else if (etfFlowNetUsd < -200) macroBonus = -4;
  }

  const compositeScore = Math.max(5, Math.min(98, Math.round(
    technicalScore + orderFlowScore + microstructureScore + derivativesScore + macroBonus
  )));

  // Regime classification
  let regime: CryptoRegime = "RANGE_EQUILIBRIUM";
  if (quadrant === "SHORT_SQUEEZE" || (funding < -0.005 && compositeScore >= 60)) {
    regime = "SHORT_SQUEEZE_SETUP";
  } else if (compositeScore >= 78) {
    regime = "INSTITUTIONAL_EXPANSION";
  } else if (compositeScore >= 60) {
    regime = "BULLISH_ACCUMULATION";
  } else if (compositeScore <= 28 || (signals.breakdown && funding > 0.025)) {
    regime = "LONG_LIQUIDATION_RISK";
  } else if (compositeScore <= 42) {
    regime = "BEARISH_DISTRIBUTION";
  }

  const regimeLabels = isId ? {
    INSTITUTIONAL_EXPANSION: "KONFLUENSI BULLISH TINGGI",
    SHORT_SQUEEZE_SETUP: "POTENSI SHORT SQUEEZE",
    BULLISH_ACCUMULATION: "AKUMULASI BULLISH",
    RANGE_EQUILIBRIUM: "KONSOLIDASI / NETRAL",
    BEARISH_DISTRIBUTION: "DISTRIBUSI SELLER",
    LONG_LIQUIDATION_RISK: "RISIKO LIKUIDASI LONG",
  } : {
    INSTITUTIONAL_EXPANSION: "HIGH BULLISH CONFLUENCE",
    SHORT_SQUEEZE_SETUP: "SHORT SQUEEZE SETUP",
    BULLISH_ACCUMULATION: "BULLISH ACCUMULATION",
    RANGE_EQUILIBRIUM: "RANGE EQUILIBRIUM",
    BEARISH_DISTRIBUTION: "BEARISH DISTRIBUTION",
    LONG_LIQUIDATION_RISK: "LONG LIQUIDATION HAZARD",
  };

  const regimeDescs = isId ? {
    INSTITUTIONAL_EXPANSION: "Konfluensi tinggi antara taker buy agregat, dukungan order book tebal, dan tren teknikal solid.",
    SHORT_SQUEEZE_SETUP: "Funding negatif dan konteks harga membentuk hipotesis squeeze; jumlah posisi short dan likuidasi tidak teramati.",
    BULLISH_ACCUMULATION: "Heuristik tekanan beli; order bid dapat dibatalkan.",
    RANGE_EQUILIBRIUM: "Order book seimbang tanpa dominasi agresor; menunggu breakout level kunci.",
    BEARISH_DISTRIBUTION: "Tekanan jual agresor mendominasi taker trades; dinding ask menahan kenaikan.",
    LONG_LIQUIDATION_RISK: "Funding rate terlalu panas di tengah kelemahan struktur teknikal; waspadai cascade stop-loss.",
  } : {
    INSTITUTIONAL_EXPANSION: "High confluence between aggregate taker buying, deep book support, and intact technical trend.",
    SHORT_SQUEEZE_SETUP: "Negative funding and price context form a squeeze hypothesis, not observed short positions or liquidations.",
    BULLISH_ACCUMULATION: "Buying pressure heuristic; resting bids may be cancelled.",
    RANGE_EQUILIBRIUM: "Balanced order book without aggressor dominance; await key level expansion.",
    BEARISH_DISTRIBUTION: "Taker sell aggressors dominate trades; heavy ask walls capping price ascent.",
    LONG_LIQUIDATION_RISK: "Overheated long leverage facing structural breakdown; elevated risk of margin cascades.",
  };

  const quadrantLabels = isId ? {
    LONG_EXPANSION: "Tren naik / funding positif",
    SHORT_SQUEEZE: "Akumulasi Squeeze Short",
    SHORT_BUILDING: "Tren turun / funding",
    LONG_LIQUIDATION: "Risiko likuidasi long",
    NEUTRAL_FLOW: "Arus Derivatif Seimbang",
  } : {
    LONG_EXPANSION: "Uptrend / positive funding",
    SHORT_SQUEEZE: "Short Squeeze Loading",
    SHORT_BUILDING: "Downtrend / funding",
    LONG_LIQUIDATION: "Long liquidation risk",
    NEUTRAL_FLOW: "Balanced Derivatives Flow",
  };

  const fundingStatus = derivatives
    ? `${derivatives.fundingPercent > 0 ? "+" : ""}${derivatives.fundingPercent.toFixed(4)}%`
    : isId ? "Data perp belum aktif" : "Perp data inactive";

  const oiStatus = flow?.openInterest
    ? `${flow.openInterest.quantity.toLocaleString()} unit`
    : isId ? "OI belum aktif" : "OI inactive";

  // Actionable execution plan
  const close = signals.last.close;
  const atr = signals.atr > 0 ? signals.atr : close * 0.015;
  const invalidationPrice = signals.trend === "up" ? Math.min(signals.priorLow, close - atr * 1.8) : Math.max(signals.priorHigh, close + atr * 1.8);
  const takeProfitTarget = signals.trend === "up" ? close + atr * 3.2 : close - atr * 3.2;

  let stance: CryptoIntelComposite["executionPlan"]["stance"] = "NEUTRAL_STAND_ASIDE";
  let stanceLabel = isId ? "Tunggu Konfirmasi Level" : "Wait for Level Confirmation";
  const estimatedWinRate = null;

  if (regime === "INSTITUTIONAL_EXPANSION" || regime === "SHORT_SQUEEZE_SETUP") {
    stance = signals.breakout ? "BUY_BREAKOUT" : "BUY_PULLBACK";
    stanceLabel = signals.breakout
      ? (isId ? "Beli Saat Breakout Terkonfirmasi" : "Buy Confirmed Breakout")
      : (isId ? "Akumulasi Saat Pullback ke EMA 20" : "Accumulate on EMA 20 Pullback");
  } else if (regime === "BULLISH_ACCUMULATION") {
    stance = "HOLD_ACCUMULATE";
    stanceLabel = isId ? "Akumulasi Bertahap (DCA / Limit)" : "Tiered Accumulation (Limit Bids)";
  } else if (regime === "BEARISH_DISTRIBUTION") {
    stance = "CAUTION_DISTRIBUTION";
    stanceLabel = isId ? "Kurangi Eksposur / Pasang Stop Ketat" : "De-risk / Tighten Stops";
  } else if (regime === "LONG_LIQUIDATION_RISK") {
    stance = "HEDGE_SHORT";
    stanceLabel = isId ? "Waspadai Flush / Lindung Nilai" : "Hedge Exposure / Cash Defense";
  }

  const actionableThesis = isId
    ? `Skor kuantitatif ${compositeScore}/100 mencerminkan kondisi ${regimeLabels[regime]}. Order flow mencatat rasio taker buy ${trades ? trades.buyRatio.toFixed(1) : "—"}% dengan net whale flow ${trades ? (trades.whaleNetValue >= 0 ? "+$" : "-$") + Math.abs(Math.round(trades.whaleNetValue)).toLocaleString() : "—"} USDT. Order book menunjukkan ${depth ? (depth.imbalance >= 0 ? "kelebihan penawaran beli " : "kelebihan penawaran jual ") + Math.abs(depth.imbalance).toFixed(1) + "%" : "data terbatas"}.`
    : `Quantitative score of ${compositeScore}/100 establishes ${regimeLabels[regime]}. Order flow records a ${trades ? trades.buyRatio.toFixed(1) : "—"}% taker buy ratio with net whale aggression at ${trades ? (trades.whaleNetValue >= 0 ? "+$" : "-$") + Math.abs(Math.round(trades.whaleNetValue)).toLocaleString() : "—"} USDT. Order book indicates a ${depth ? (depth.imbalance >= 0 ? "bid surplus of " : "ask surplus of ") + Math.abs(depth.imbalance).toFixed(1) + "%" : "limited book"}.`;

  return {
    compositeScore,
    regime,
    regimeLabel: regimeLabels[regime],
    regimeDesc: regimeDescs[regime],
    factors: {
      technicalScore,
      orderFlowScore,
      microstructureScore,
      derivativesScore,
    },
    leverageMatrix: {
      quadrant,
      quadrantLabel: quadrantLabels[quadrant],
      fundingStatus,
      oiStatus,
      squeezeRisk,
    },
    informedFlow,
    actionableThesis,
    executionPlan: {
      stance,
      stanceLabel,
      invalidationPrice,
      takeProfitTarget,
      estimatedWinRate,
    },
  };
}
