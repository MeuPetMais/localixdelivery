import { describe, expect, it } from "vitest";
import { canReadCustomer360Restaurant } from "./customer360-access";

describe("GROWTH-4 Customer 360 tenant security matrix", () => {
  const userA = "00000000-0000-0000-0000-000000000001";
  const userB = "00000000-0000-0000-0000-000000000002";

  it("allows the restaurant owner", () => {
    expect(canReadCustomer360Restaurant({
      userId: userA,
      restaurantOwnerId: userA,
      isAdmin: false,
      hasGrowthRole: false,
      hasActiveGrowthAssignment: false,
    })).toBe(true);
  });

  it("allows admin independent of ownership", () => {
    expect(canReadCustomer360Restaurant({
      userId: userA,
      restaurantOwnerId: userB,
      isAdmin: true,
      hasGrowthRole: false,
      hasActiveGrowthAssignment: false,
    })).toBe(true);
  });

  it("allows Partner Growth only with active assignment for that restaurant", () => {
    expect(canReadCustomer360Restaurant({
      userId: userA,
      restaurantOwnerId: userB,
      isAdmin: false,
      hasGrowthRole: true,
      hasActiveGrowthAssignment: true,
    })).toBe(true);
  });

  it("denies Partner Growth without active assignment", () => {
    expect(canReadCustomer360Restaurant({
      userId: userA,
      restaurantOwnerId: userB,
      isAdmin: false,
      hasGrowthRole: true,
      hasActiveGrowthAssignment: false,
    })).toBe(false);
  });

  it("denies active assignment without Partner Growth role", () => {
    expect(canReadCustomer360Restaurant({
      userId: userA,
      restaurantOwnerId: userB,
      isAdmin: false,
      hasGrowthRole: false,
      hasActiveGrowthAssignment: true,
    })).toBe(false);
  });

  it("denies a common authenticated user", () => {
    expect(canReadCustomer360Restaurant({
      userId: userA,
      restaurantOwnerId: userB,
      isAdmin: false,
      hasGrowthRole: false,
      hasActiveGrowthAssignment: false,
    })).toBe(false);
  });

  it("denies cross-tenant access from an owner of another restaurant", () => {
    expect(canReadCustomer360Restaurant({
      userId: userA,
      restaurantOwnerId: userB,
      isAdmin: false,
      hasGrowthRole: false,
      hasActiveGrowthAssignment: false,
    })).toBe(false);
  });
});
