import type { AIForecastRequest, AIForecastResult } from "./types";

/**
 * Pure statistical scaffold — never calls a model. Uses a linear
 * regression on the provided history and returns a projection with a
 * band derived from residual stddev. Real ML lives in Prompt 19+.
 */
export const AIForecastService = {
  forecast(req: AIForecastRequest): AIForecastResult {
    const pts = req.history.filter((p) => Number.isFinite(p.value));
    if (pts.length < 2) {
      const flat = pts[0]?.value ?? 0;
      return {
        kind: req.kind, horizon_days: req.horizon_days, trend: "flat", confidence: 0,
        points: Array.from({ length: req.horizon_days }, (_, i) => ({
          date: addDays(new Date(), i + 1), value: flat, lower: flat, upper: flat,
        })),
      };
    }
    // linear regression on index
    const n = pts.length;
    const xs = pts.map((_, i) => i);
    const ys = pts.map((p) => p.value);
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
    const slope = num / den;
    const intercept = my - slope * mx;

    const residuals = ys.map((y, i) => y - (slope * i + intercept));
    const rmse = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);
    const yhat = ys.map((_, i) => slope * i + intercept);
    const ssRes = residuals.reduce((s, r) => s + r * r, 0);
    const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0) || 1;
    const r2 = Math.max(0, 1 - ssRes / ssTot);
    void yhat;

    const points: AIForecastResult["points"] = [];
    for (let i = 1; i <= req.horizon_days; i++) {
      const idx = n - 1 + i;
      const v = Math.max(0, slope * idx + intercept);
      points.push({
        date: addDays(new Date(), i),
        value: round(v),
        lower: round(Math.max(0, v - 1.96 * rmse)),
        upper: round(v + 1.96 * rmse),
      });
    }

    const trend = slope > 0.001 ? "up" : slope < -0.001 ? "down" : "flat";
    return { kind: req.kind, horizon_days: req.horizon_days, points, trend, confidence: Math.round(r2 * 100) / 100 };
  },
} as const;

function addDays(base: Date, d: number): string {
  const nd = new Date(base); nd.setDate(nd.getDate() + d);
  return nd.toISOString().slice(0, 10);
}
function round(v: number) { return Math.round(v * 100) / 100; }
