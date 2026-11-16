// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Gate 4B: do not produce a runnable Vercel preview for this financial PR
 * unless every relevant build-time environment points to the isolated sandbox.
 * This is an attestation gate, not authorization for an E2E payment test.
 * Never print values of Supabase or MP environment variables.
 */
if (process.env.VERCEL === "1" &&
    process.env.VERCEL_GIT_COMMIT_REF === "fix/gate4b-owner-authorization-status") {
  const isolated = "gvozcqyjhogmvebrwzap";
  const expectedUrl = `https://${isolated}.supabase.co`;
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.SUPABASE_URL !== expectedUrl ||
    process.env.VITE_SUPABASE_URL !== expectedUrl ||
    process.env.VITE_SUPABASE_PROJECT_ID !== isolated ||
    process.env.LOCALIX_ENV !== "staging" ||
    process.env.MP_ENVIRONMENT !== "test"
  ) {
    throw new Error("gate4b_preview_environment_attestation_failed");
  }
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
