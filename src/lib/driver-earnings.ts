export type DriverEarningSettings = {
  base_fee: number;
  per_km_fee: number;
  minimum_fee: number;
  maximum_fee: number | null;
  is_active?: boolean;
};

export type DriverEarningSnapshot = {
  distance_km?: number | null;
  driver_base_fee?: number | null;
  driver_per_km_fee?: number | null;
  driver_distance_km?: number | null;
  driver_earning_amount?: number | null;
  driver_earning_calculated_at?: string | null;
  metadata?: Record<string, any> | null;
};

export type ResolvedDriverEarning = {
  amount: number;
  source: "snapshot" | "legacy_fallback";
  distanceKm: number | null;
  distanceMissing: boolean;
};

export const DEFAULT_DRIVER_EARNING_SETTINGS: DriverEarningSettings = {
  base_fee: 8,
  per_km_fee: 1.5,
  minimum_fee: 8,
  maximum_fee: null,
  is_active: true,
};

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function cleanNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeDriverEarningSettings(
  settings?: Partial<DriverEarningSettings> | null,
): DriverEarningSettings {
  const base = DEFAULT_DRIVER_EARNING_SETTINGS;
  const maximumRaw = settings?.maximum_fee;
  const maximum = maximumRaw == null ? null : Math.max(0, cleanNumber(maximumRaw, 0));
  return {
    base_fee: Math.max(0, cleanNumber(settings?.base_fee, base.base_fee)),
    per_km_fee: Math.max(0, cleanNumber(settings?.per_km_fee, base.per_km_fee)),
    minimum_fee: Math.max(0, cleanNumber(settings?.minimum_fee, base.minimum_fee)),
    maximum_fee: maximum,
    is_active: settings?.is_active ?? true,
  };
}

export function calculateDriverEarning(
  settingsInput: Partial<DriverEarningSettings> | null | undefined,
  distanceKmInput: number | null | undefined,
): { amount: number; distanceKm: number | null; distanceMissing: boolean } {
  const settings = normalizeDriverEarningSettings(settingsInput);
  const distanceMissing =
    distanceKmInput == null ||
    !Number.isFinite(Number(distanceKmInput)) ||
    Number(distanceKmInput) <= 0;
  const distanceKm = distanceMissing ? null : Math.max(0, Number(distanceKmInput));
  const gross = settings.base_fee + settings.per_km_fee * (distanceKm ?? 0);
  const withMinimum = Math.max(settings.minimum_fee, gross);
  const capped = settings.maximum_fee != null ? Math.min(settings.maximum_fee, withMinimum) : withMinimum;
  return { amount: money(capped), distanceKm, distanceMissing };
}

export function resolveDriverEarning(row: DriverEarningSnapshot): ResolvedDriverEarning {
  const amount = Number(row.driver_earning_amount);
  if (Number.isFinite(amount) && row.driver_earning_calculated_at) {
    const distanceRaw = row.driver_distance_km;
    const distanceKm = distanceRaw == null ? null : Number(distanceRaw);
    return {
      amount: money(amount),
      source: "snapshot",
      distanceKm: Number.isFinite(distanceKm as number) ? distanceKm : null,
      distanceMissing: !!row.metadata?.driver_earning_distance_missing,
    };
  }

  const legacy = calculateDriverEarning(
    DEFAULT_DRIVER_EARNING_SETTINGS,
    row.driver_distance_km ?? row.distance_km,
  );
  return {
    amount: legacy.amount,
    source: "legacy_fallback",
    distanceKm: legacy.distanceKm,
    distanceMissing: legacy.distanceMissing,
  };
}
