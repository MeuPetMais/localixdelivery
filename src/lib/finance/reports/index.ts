// Reports & Executive Intelligence — public entry point.
import { FinanceDomain } from "../FinanceDomain";
import { ReportEngine } from "./ReportEngine";
import { ExportEngine } from "./ExportEngine";
import { FinancialReportService } from "./FinancialReportService";

export * from "./types";
export { ReportEngine } from "./ReportEngine";
export { ExportEngine } from "./ExportEngine";
export { ScheduleEngine } from "./ScheduleEngine";
export { FinancialReportService } from "./FinancialReportService";
export { ReportEventBus } from "./ReportEventBus";
export type { ExportPayload } from "./ExportEngine";
export type { GenerateInput, GenerateOutput } from "./FinancialReportService";

export const ReportsDomain = {
  createReportService() {
    const dashboard = FinanceDomain.createDashboardService();
    const cashflow = FinanceDomain.createCashFlowService();
    const receivables = FinanceDomain.createReceivablesService();
    const payables = FinanceDomain.createPayablesService();
    const engine = new ReportEngine({ dashboard, cashflow, receivables, payables });
    const exporter = new ExportEngine();
    return new FinancialReportService({ engine, exporter });
  },
};
