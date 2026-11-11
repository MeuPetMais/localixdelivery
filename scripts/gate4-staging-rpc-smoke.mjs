/** Gate 4 read-only smoke test. STAGING ONLY.
 * Environment: GATE4_STAGING_ANON_KEY, GATE4_STAGING_RESTAURANT_ID,
 * GATE4_STAGING_OWNER_JWT, GATE4_STAGING_OTHER_OWNER_JWT, GATE4_STAGING_ADMIN_JWT.
 * Never print token values or financial entries.
 */
const baseUrl = "https://dnotmvbhuqujvqdtgzav.supabase.co";
const keys = [
  "GATE4_STAGING_ANON_KEY",
  "GATE4_STAGING_RESTAURANT_ID",
  "GATE4_STAGING_OWNER_JWT",
  "GATE4_STAGING_OTHER_OWNER_JWT",
  "GATE4_STAGING_ADMIN_JWT",
];
const missing = keys.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`BLOCK: staging test credentials missing: ${missing.join(", ")}`);
  process.exitCode = 2;
} else {
  const id = process.env.GATE4_STAGING_RESTAURANT_ID;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(id)) throw new Error("BLOCK: invalid staging restaurant UUID");
  const endpoint = `${baseUrl}/rest/v1/rpc/get_restaurant_financial_snapshot`;

  async function call(role, token) {
    const headers = {
      apikey: process.env.GATE4_STAGING_ANON_KEY,
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ _restaurant_id: id }),
      signal: AbortSignal.timeout(15000),
    });
    if (role === "anonymous") {
      if (response.status !== 401 && response.status !== 403) {
        throw new Error(`FAIL: anonymous response must be HTTP 401/403, got ${response.status}`);
      }
      console.log("PASS: anonymous execution denied (HTTP 401/403)");
      return 0;
    }
    if (!response.ok) throw new Error(`FAIL: ${role} HTTP ${response.status}`);
    const payload = await response.json();
    const snapshot = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (
      !snapshot ||
      snapshot.version !== 1 ||
      snapshot.complete !== true ||
      !Array.isArray(snapshot.entries) ||
      snapshot.restaurant_id !== id ||
      snapshot.row_count !== snapshot.entries.length
    ) {
      throw new Error(`FAIL: ${role} invalid snapshot contract`);
    }
    return snapshot.row_count;
  }

  try {
    await call("anonymous");
    const owner = await call("owner", process.env.GATE4_STAGING_OWNER_JWT);
    const other = await call("other owner", process.env.GATE4_STAGING_OTHER_OWNER_JWT);
    const admin = await call("admin", process.env.GATE4_STAGING_ADMIN_JWT);
    if (owner < 1 || other !== 0 || admin !== owner) {
      throw new Error("FAIL: owner / other owner / admin isolation");
    }
    console.log("PASS: owner, other tenant, admin, version and completeness");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "FAIL: unexpected error");
    process.exitCode = 1;
  }
}
