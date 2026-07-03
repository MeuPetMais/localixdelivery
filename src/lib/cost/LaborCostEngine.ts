export interface LaborInput { hourlyRate: number; minutes: number; team?: number }

export const LaborCostEngine = {
  calculate({ hourlyRate, minutes, team = 1 }: LaborInput): number {
    return (Math.max(0, hourlyRate) / 60) * Math.max(0, minutes) * Math.max(1, team);
  },
};
