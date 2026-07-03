export type ConfigurationEvent =
  | { type: "OptionCreated"; option_id: string; group_id: string }
  | { type: "OptionUpdated"; option_id: string }
  | { type: "OptionDeleted"; option_id: string }
  | { type: "GroupCreated"; group_id: string; product_id: string }
  | { type: "GroupUpdated"; group_id: string }
  | { type: "ConfigurationChanged"; product_id: string }
  | { type: "ComboCreated"; product_id: string }
  | { type: "ComboUpdated"; product_id: string };

type Listener = (e: ConfigurationEvent) => void;
const listeners = new Set<Listener>();

export const ConfigurationEventBus = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  publish(e: ConfigurationEvent) {
    for (const l of listeners) {
      try {
        l(e);
      } catch {
        /* noop */
      }
    }
  },
  clear() {
    listeners.clear();
  },
};
