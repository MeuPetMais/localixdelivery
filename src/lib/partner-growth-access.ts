import type { AppRole } from "@/hooks/use-role";

export type PartnerGrowthRestaurant = {
  id: string;
  name: string;
};

export type PartnerGrowthAssignment = {
  id: string;
  restaurantId: string;
  active: boolean;
  restaurant: PartnerGrowthRestaurant | null;
};

export type PartnerGrowthAccessState =
  | "unauthenticated"
  | "forbidden"
  | "no_active_assignment"
  | "allowed";

export function resolvePartnerGrowthAccess(input: {
  userId: string | null;
  roles: AppRole[];
  assignments: PartnerGrowthAssignment[];
}): PartnerGrowthAccessState {
  if (!input.userId) return "unauthenticated";
  if (!input.roles.includes("partner_growth")) return "forbidden";
  if (!input.assignments.some((assignment) => assignment.active)) {
    return "no_active_assignment";
  }
  return "allowed";
}
