// Tracking Domain — Barrel público.
export * from "./tracking.types";
export * from "./tracking.contracts";
export * from "./tracking.events";
export { trackingService, createTrackingService } from "./tracking.service";
export type { TrackingService } from "./tracking.service";
export { trackingOrchestrator, createTrackingOrchestrator } from "./tracking.orchestrator";
export type { TrackingOrchestrator } from "./tracking.orchestrator";
export {
  trackingChannelNames,
  subscribeRestaurantTracking,
  subscribePublicOrderTracking,
  subscribeDriverTracking,
} from "./tracking.realtime";
export { setTrackingAuditSink, recordTrackingAudit } from "./tracking.audit";
export type { TrackingAuditRecord } from "./tracking.audit";
