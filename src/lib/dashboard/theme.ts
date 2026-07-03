import type { DashboardBranding } from "./types";

export function buildDashboardCssVars(branding?: DashboardBranding): Record<string, string> {
  const vars: Record<string, string> = {};
  if (branding?.primaryColor) vars["--dashboard-primary"] = branding.primaryColor;
  if (branding?.secondaryColor) vars["--dashboard-secondary"] = branding.secondaryColor;
  if (branding?.accentColor) vars["--dashboard-accent"] = branding.accentColor;
  return vars;
}

export const DEFAULT_DASHBOARD_BRANDING: DashboardBranding = {
  primaryColor: undefined,
  secondaryColor: undefined,
  accentColor: undefined,
};
