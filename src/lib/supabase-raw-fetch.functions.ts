import { createServerFn } from "@tanstack/react-start";

type RawFetchResult = {
  status: number | null;
  body: string | null;
  headers: Record<string, string>;
  "cf-ray": string | null;
  "request-id": string | null;
};

const SUPABASE_REST_URL = "https://mvkfrwxgneqzvoabkaws.supabase.co/rest/v1/";

export const runSupabaseRawFetch = createServerFn({ method: "GET" }).handler(
  async (): Promise<RawFetchResult> => {
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return {
        status: null,
        body: "Missing SUPABASE_SERVICE_ROLE_KEY",
        headers: {},
        "cf-ray": null,
        "request-id": null,
      };
    }

    const response = await fetch(SUPABASE_REST_URL, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    const headers = Object.fromEntries(response.headers.entries());

    return {
      status: response.status,
      body: await response.text(),
      headers,
      "cf-ray": response.headers.get("cf-ray"),
      "request-id": response.headers.get("request-id"),
    };
  },
);
