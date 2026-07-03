// MetricsCenter — coleta pontual e agrega janela recente.
import type { MetricPoint, MetricsSummary } from "./types";

const WINDOW_MS = 60_000;
const MAX = 5000;
const points: MetricPoint[] = [];

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  while (points.length && Date.parse(points[0].at) < cutoff) points.shift();
  if (points.length > MAX) points.splice(0, points.length - MAX);
}

export const MetricsCenter = {
  record(name: string, value: number, tags?: Record<string, string>): MetricPoint {
    const p: MetricPoint = { name, value, tags, at: new Date().toISOString() };
    points.push(p);
    prune();
    return p;
  },
  incr(name: string, tags?: Record<string, string>) { return this.record(name, 1, tags); },
  timing(name: string, ms: number, tags?: Record<string, string>) { return this.record(name, ms, tags); },
  filter(name?: string): MetricPoint[] {
    prune();
    return name ? points.filter((p) => p.name === name) : [...points];
  },
  summary(): MetricsSummary {
    prune();
    const requests = points.filter((p) => p.name === "request").length;
    const errors = points.filter((p) => p.name === "error").length;
    const responseTimes = points.filter((p) => p.name === "response_ms").map((p) => p.value);
    const edgeTimes = points.filter((p) => p.name === "edge_function_ms").map((p) => p.value);
    const jobs = points.filter((p) => p.name === "job_executed").length;
    const queued = points.filter((p) => p.name === "queue_pending").reduce((a, p) => a + p.value, 0);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const total = requests + errors;
    return {
      window_seconds: WINDOW_MS / 1000,
      requests_per_minute: requests,
      errors_per_minute: errors,
      success_rate: total > 0 ? requests / total : 1,
      avg_response_ms: Math.round(avg(responseTimes)),
      edge_function_avg_ms: Math.round(avg(edgeTimes)),
      jobs_executed: jobs,
      queues_pending: queued,
      at: new Date().toISOString(),
    };
  },
  _reset() { points.length = 0; },
} as const;
