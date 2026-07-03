import type { Employee, EmployeeRepository, EmployeeRole } from "./types";
import { PermissionRegistry } from "./PermissionRegistry";
import { RestaurantSettingsEventBus } from "./RestaurantSettingsEventBus";

export class EmployeeService {
  constructor(
    private readonly repo: EmployeeRepository,
    private readonly bus?: RestaurantSettingsEventBus,
  ) {}

  list(restaurantId: string) { return this.repo.list(restaurantId); }

  async invite(input: Omit<Employee, "id" | "created_at" | "active"> & { active?: boolean }) {
    const saved = await this.repo.upsert({ ...input, active: input.active ?? true });
    this.bus?.publish({ type: "EmployeeCreated", restaurant_id: saved.restaurant_id, employee_id: saved.id, role: saved.role });
    return saved;
  }

  async updateRole(employeeId: string, restaurantId: string, role: EmployeeRole, existing: Employee) {
    const saved = await this.repo.upsert({ ...existing, id: employeeId, role });
    this.bus?.publish({ type: "EmployeeUpdated", restaurant_id: restaurantId, employee_id: employeeId, role });
    return saved;
  }

  async remove(restaurantId: string, employeeId: string) {
    await this.repo.remove(restaurantId, employeeId);
    this.bus?.publish({ type: "EmployeeRemoved", restaurant_id: restaurantId, employee_id: employeeId });
  }

  permissionsOf(role: EmployeeRole) { return PermissionRegistry.for(role); }
}
