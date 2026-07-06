// Stripe Domain — Checkout.
// Cria PaymentIntents / Checkout Sessions / Customers via API do Stripe.
//
// IMPORTANTE
//  - Toda comunicação real com o Stripe acontece dentro de Edge Functions
//    (`stripe-checkout`, `stripe-webhook`, futuro milestone). Este módulo
//    define o contrato do domínio e valida entrada.
//  - Neste milestone, nenhuma chamada real é feita. Cada método lança
//    ou retorna placeholder — o comportamento atual da plataforma não muda.
//  - Nenhum consumidor externo usa este serviço diretamente: sempre via
//    `StripeService.checkout`.

export interface CheckoutSessionInput {
  restaurantId: string;
  orderId: string;
  amount: number;          // centavos
  currency?: string;       // default "brl"
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentInput {
  restaurantId: string;
  orderId: string;
  amount: number;          // centavos
  currency?: string;       // default "brl"
  customerId?: string;
  paymentMethodTypes?: Array<"card" | "pix" | "boleto">;
  metadata?: Record<string, string>;
}

export interface CustomerInput {
  restaurantId: string;
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  paymentIntentId: string | null;
  status: "open" | "complete" | "expired";
}

export interface PaymentIntent {
  id: string;
  clientSecret: string | null;
  status:
    | "requires_payment_method"
    | "requires_confirmation"
    | "requires_action"
    | "processing"
    | "succeeded"
    | "canceled"
    | "requires_capture";
  amount: number;
  currency: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

function validateAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("StripeCheckoutService: amount deve ser inteiro > 0 (centavos).");
  }
}

export const StripeCheckoutService = {
  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession> {
    validateAmount(input.amount);
    if (!input.successUrl || !input.cancelUrl) {
      throw new Error("StripeCheckoutService: successUrl e cancelUrl são obrigatórios.");
    }
    throw new Error("StripeCheckoutService.createCheckoutSession não implementado (milestone futuro).");
  },

  async createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    validateAmount(input.amount);
    throw new Error("StripeCheckoutService.createPaymentIntent não implementado (milestone futuro).");
  },

  async retrievePaymentIntent(_id: string): Promise<PaymentIntent | null> {
    return null;
  },

  async cancelPaymentIntent(_id: string, _reason?: string): Promise<void> {
    throw new Error("StripeCheckoutService.cancelPaymentIntent não implementado (milestone futuro).");
  },

  async createCustomer(input: CustomerInput): Promise<Customer> {
    if (!input.email) throw new Error("StripeCheckoutService.createCustomer: email obrigatório.");
    throw new Error("StripeCheckoutService.createCustomer não implementado (milestone futuro).");
  },

  async retrieveCustomer(_id: string): Promise<Customer | null> {
    return null;
  },
};

export default StripeCheckoutService;
