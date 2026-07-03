// FinancialReportService — thin orchestrator combining ReportEngine,
// ExportEngine and the persistence layer (reports.functions).
// Publishes ReportEventBus events for NotificationCenter subscribers.

import type { ReportEngine } from "./ReportEngine";
import type { ExportEngine, ExportPayload } from "./ExportEngine";
import { ReportEventBus } from "./ReportEventBus";
import type { ExportFormat, ReportResult, ReportType } from "./types";
import type { FinanceFilters } from "../types";

export interface FinancialReportServicePorts {
  engine: ReportEngine;
  exporter: ExportEngine;
}

export interface GenerateInput {
  restaurantId: string;
  type: ReportType;
  filters?: Partial<FinanceFilters>;
  format?: ExportFormat;
}

export interface GenerateOutput {
  result: ReportResult;
  export?: ExportPayload;
}

export class FinancialReportService {
  constructor(private readonly ports: FinancialReportServicePorts) {}

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    ReportEventBus.emit({ type: "ReportRequested", restaurantId: input.restaurantId, payload: { type: input.type } });
    try {
      const result = await this.ports.engine.build(input);
      ReportEventBus.emit({ type: "ReportGenerated", restaurantId: input.restaurantId, payload: { type: input.type, rows: result.rows.length } });
      if (input.format) {
        const payload = this.ports.exporter.export(result, input.format);
        ReportEventBus.emit({ type: "ReportExported", restaurantId: input.restaurantId, payload: { type: input.type, format: input.format } });
        return { result, export: payload };
      }
      return { result };
    } catch (err) {
      ReportEventBus.emit({
        type: "ReportGenerated", restaurantId: input.restaurantId,
        payload: { type: input.type, error: (err as Error).message, failed: true },
      });
      throw err;
    }
  }

  export(result: ReportResult, format: ExportFormat, restaurantId: string): ExportPayload {
    const p = this.ports.exporter.export(result, format);
    ReportEventBus.emit({ type: "ReportExported", restaurantId, payload: { type: result.type, format } });
    return p;
  }
}
