export type Customer360RestaurantAccessInput = {
  userId: string;
  restaurantOwnerId: string | null;
  isAdmin: boolean;
  hasGrowthRole: boolean;
  hasActiveGrowthAssignment: boolean;
};

export function canReadCustomer360Restaurant(input: Customer360RestaurantAccessInput): boolean {
  if (input.restaurantOwnerId === input.userId) return true;
  if (input.isAdmin) return true;
  if (input.hasGrowthRole && input.hasActiveGrowthAssignment) return true;
  return false;
}
