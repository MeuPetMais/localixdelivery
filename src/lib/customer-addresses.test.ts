import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredAddress = {
  id: string;
  customer_id: string;
  label: string;
  cep: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string;
  city: string | null;
  state: string | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

const db = vi.hoisted(() => ({
  rows: [] as StoredAddress[],
  insertError: null as { message: string } | null,
  inserts: [] as Array<Partial<StoredAddress>>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      if (table !== "customer_addresses") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select() {
          let orderCalls = 0;
          return {
            eq(_column: string, value: string) {
              db.rows = db.rows.filter((row) => row.customer_id === value);
              return this;
            },
            order() {
              orderCalls += 1;
              if (orderCalls < 2) return this;
              return Promise.resolve({ data: db.rows, error: null });
            },
          };
        },
        insert(payload: Partial<StoredAddress>) {
          db.inserts.push(payload);
          return {
            select() {
              return this;
            },
            async maybeSingle() {
              if (db.insertError) return { data: null, error: db.insertError };

              const row = {
                id: `address-${db.rows.length + 1}`,
                created_at: "2026-08-14T00:00:00.000Z",
                updated_at: "2026-08-14T00:00:00.000Z",
                ...payload,
              } as StoredAddress;
              db.rows.push(row);
              return { data: row, error: null };
            },
          };
        },
        update(payload: Partial<StoredAddress>) {
          return {
            eq(_column: string, value: string) {
              return {
                select() {
                  return this;
                },
                async maybeSingle() {
                  const row = db.rows.find((item) => item.id === value);
                  if (!row) return { data: null, error: null };
                  Object.assign(row, payload);
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        delete() {
          return {
            eq() {
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  },
}));

import { listAddresses, persistCheckoutAddressForCustomer } from "./customer-addresses";

const input = {
  cep: "01310-200",
  street: "Av. Paulista",
  number: "1578",
  complement: "Apto 12",
  neighborhood: "Bela Vista",
  city: "Sao Paulo",
  state: "SP",
  reference: "Portaria",
};

beforeEach(() => {
  db.rows = [];
  db.insertError = null;
  db.inserts = [];
});

describe("persistCheckoutAddressForCustomer", () => {
  it("salva o primeiro endereco do cliente como default", async () => {
    const saved = await persistCheckoutAddressForCustomer("user-1", input);

    expect(saved).toMatchObject({
      customer_id: "user-1",
      cep: "01310200",
      street: "Av. Paulista",
      number: "1578",
      is_default: true,
    });
    expect(db.inserts).toHaveLength(1);
  });

  it("nao duplica endereco equivalente para o mesmo cliente", async () => {
    await persistCheckoutAddressForCustomer("user-1", input);
    const savedAgain = await persistCheckoutAddressForCustomer("user-1", {
      ...input,
      cep: "01310200",
      street: "  av. paulista ",
      number: " 1578 ",
    });

    expect(savedAgain?.id).toBe("address-1");
    expect(db.inserts).toHaveLength(1);
  });

  it("salva endereco diferente sem torna-lo default quando cliente ja possui endereco", async () => {
    await persistCheckoutAddressForCustomer("user-1", input);
    const second = await persistCheckoutAddressForCustomer("user-1", {
      ...input,
      street: "Rua Augusta",
      number: "100",
    });

    expect(second).toMatchObject({
      street: "Rua Augusta",
      number: "100",
      is_default: false,
    });
    expect(db.inserts).toHaveLength(2);
  });

  it("propaga falha de insert para o checkout tratar como persistencia secundaria", async () => {
    db.insertError = { message: "insert failed" };

    await expect(persistCheckoutAddressForCustomer("user-1", input)).rejects.toMatchObject({
      message: "insert failed",
    });
  });

  it("permite que novo checkout encontre o endereco salvo", async () => {
    await persistCheckoutAddressForCustomer("user-1", input);

    await expect(listAddresses("user-1")).resolves.toMatchObject([
      {
        customer_id: "user-1",
        street: "Av. Paulista",
        number: "1578",
      },
    ]);
  });
});
