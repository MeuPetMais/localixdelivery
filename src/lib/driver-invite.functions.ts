import { createServerFn } from "@tanstack/react-start";
import { APP_BASE_URL, DRIVER_ACTIVATION_APP_URL } from "./driver-invite";

function normalizeBaseUrl(value: string | undefined): string {
  const base = value?.trim() || APP_BASE_URL;
  return base.replace(/\/+$/, "");
}

export const getDriverActivationUrl = createServerFn({ method: "GET" }).handler(
  async () => {
    const baseUrl = normalizeBaseUrl(
      process.env.APP_BASE_URL ??
        process.env.APP_URL ??
        process.env.SITE_URL ??
        process.env.PUBLIC_URL ??
        process.env.BASE_URL,
    );

    return `${baseUrl}${DRIVER_ACTIVATION_APP_URL}`;
  },
);
