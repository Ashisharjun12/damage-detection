const USD_PER_M_INPUT = 0.3;
const USD_PER_M_OUTPUT = 2.5;
const INR_PER_USD = 95.56;

function computeFromTokens(inputTokens, outputTokens) {
  const inputUsd = (inputTokens / 1_000_000) * USD_PER_M_INPUT;
  const outputUsd = (outputTokens / 1_000_000) * USD_PER_M_OUTPUT;
  const usd = Math.round((inputUsd + outputUsd) * 1_000_000) / 1_000_000;
  const inr = Math.round(usd * INR_PER_USD * 100) / 100;
  return { usd, inr };
}

export function getGeminiCostSummary(processing) {
  if (!processing) return null;

  const inputTokens = processing.gemini_input_tokens ?? 0;
  const outputTokens = processing.gemini_output_tokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  if (totalTokens === 0 && processing.estimated_cost_inr == null) {
    return null;
  }

  const usd =
    processing.estimated_cost_usd ??
    computeFromTokens(inputTokens, outputTokens).usd;
  const inr =
    processing.estimated_cost_inr ??
    computeFromTokens(inputTokens, outputTokens).inr;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    usd,
    inr,
  };
}

export function formatInr(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatUsd(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatTokenCount(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}
