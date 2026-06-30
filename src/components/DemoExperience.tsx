import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { DemoBanner } from "./DemoBanner";
import { DemoTour } from "./DemoTour";

export const DEMO_SLUG = "demo";
export const DEMO_EMAIL = "demo@localix.app";

export function DemoExperience({ userEmail }: { userEmail?: string | null }) {
  const ctx = useRestaurantContext();
  const isDemo =
    ctx.restaurant?.slug === DEMO_SLUG ||
    (userEmail ?? "").toLowerCase() === DEMO_EMAIL;
  if (!isDemo) return null;
  return (
    <>
      <DemoBanner />
      <DemoTour />
    </>
  );
}
