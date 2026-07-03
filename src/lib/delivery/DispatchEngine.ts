import type { DispatchStrategy, DeliveryProviderId, DeliveryContext, Driver } from "./types";
import { getDeliveryProvider } from "./providers";
import { pickBestDriver } from "./AssignmentEngine";

export interface DispatchDecision {
  provider: DeliveryProviderId;
  driver?: Driver | null;
  reason: string;
  estimate?: { eta_minutes: number; fee: number };
}

export interface DispatchInput {
  strategy: DispatchStrategy;
  context: DeliveryContext;
  restaurantHasOwnFleet: boolean;
  drivers?: Driver[];
}

export class DispatchEngine {
  async choose(input: DispatchInput): Promise<DispatchDecision> {
    const { strategy, context, restaurantHasOwnFleet, drivers = [] } = input;

    const candidates: DeliveryProviderId[] = (() => {
      switch (strategy) {
        case "RESTAURANT":
          return ["RESTAURANT"];
        case "LOCALIX":
          return ["LOCALIX"];
        case "EXTERNAL":
          return ["EXTERNAL"];
        case "HYBRID":
          return restaurantHasOwnFleet ? ["RESTAURANT", "LOCALIX", "EXTERNAL"] : ["LOCALIX", "EXTERNAL"];
        case "AUTO":
        default:
          return restaurantHasOwnFleet ? ["RESTAURANT", "LOCALIX"] : ["LOCALIX", "EXTERNAL"];
      }
    })();

    for (const id of candidates) {
      const provider = getDeliveryProvider(id);
      const est = await provider.estimate(context);
      if (!est.available) continue;
      const driver =
        id === "LOCALIX"
          ? pickBestDriver(drivers, { origin: context.origin })
          : null;
      if (id === "LOCALIX" && !driver) continue;
      return {
        provider: id,
        driver,
        reason: `selected ${id}`,
        estimate: { eta_minutes: est.eta_minutes, fee: est.fee },
      };
    }

    return { provider: "RESTAURANT", reason: "fallback: no provider available" };
  }
}

export const dispatchEngine = new DispatchEngine();
