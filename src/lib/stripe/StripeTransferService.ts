// Stripe Domain — Transfers / Payouts.

import type { StripeTransfer } from "./types";

export const StripeTransferService = {
  async list(_restaurantId: string, _limit = 20): Promise<StripeTransfer[]> {
    return [];
  },
  async get(_transferId: string): Promise<StripeTransfer | null> {
    return null;
  },
  async create(_restaurantId: string, _amount: number, _currency = "brl"): Promise<StripeTransfer> {
    throw new Error("StripeTransferService.create não implementado (milestone futuro).");
  },
};

export default StripeTransferService;
