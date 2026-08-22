import { useCallback, useEffect, useId, useRef, useState } from "react";
import { loadMercadoPago } from "@mercadopago/sdk-js";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sanitizeMercadoPagoCardFormData,
  sanitizeMercadoPagoTokenizationError,
  type MercadoPagoCardFormData,
  type TransparentCardInput,
} from "@/lib/payments/transparent-card";

type CardFormController = {
  getCardFormData: () => MercadoPagoCardFormData;
  submit?: () => unknown;
  createCardToken?: () => unknown;
  unmount?: () => void;
};

type MercadoPagoInstance = {
  cardForm: (settings: unknown) => CardFormController;
};

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: Record<string, unknown>) => MercadoPagoInstance;
  }
}

export interface MercadoPagoCardPaymentProps {
  publicKey: string | null | undefined;
  amount: number;
  payerEmail: string;
  disabled?: boolean;
  onTokenized: (card: TransparentCardInput) => void;
  onTokenizingChange?: (tokenizing: boolean) => void;
}

function friendlyTokenizationError(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error ?? "");
  if (code.includes("card_token_required")) return "Confira os dados do cartao e tente novamente.";
  if (code.includes("payment_method_required"))
    return "Nao foi possivel identificar a bandeira do cartao.";
  if (code.includes("installments_required")) return "Selecione a quantidade de parcelas.";
  return "Nao foi possivel validar o cartao. Confira os dados e tente novamente.";
}

export function MercadoPagoCardPayment({
  publicKey,
  amount,
  payerEmail,
  disabled,
  onTokenized,
  onTokenizingChange,
}: MercadoPagoCardPaymentProps) {
  const reactId = useId().replace(/:/g, "");
  const formId = `mp-card-form-${reactId}`;
  const controllerRef = useRef<CardFormController | null>(null);
  const tokenizingRef = useRef(false);
  const onTokenizedRef = useRef(onTokenized);
  const onTokenizingChangeRef = useRef(onTokenizingChange);
  const [ready, setReady] = useState(false);
  const [tokenizing, setTokenizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onTokenizedRef.current = onTokenized;
    onTokenizingChangeRef.current = onTokenizingChange;
  });

  const setTokenizingState = useCallback((next: boolean) => {
    tokenizingRef.current = next;
    setTokenizing(next);
    onTokenizingChangeRef.current?.(next);
  }, []);

  const handleTokenizationError = useCallback((tokenError: unknown) => {
    console.warn("[mp-card-tokenization]", sanitizeMercadoPagoTokenizationError(tokenError));
    setError(friendlyTokenizationError(tokenError));
  }, []);

  const readTokenizedCardData = useCallback((source?: MercadoPagoCardFormData | Event | null) => {
    if (source && "token" in source) {
      return sanitizeMercadoPagoCardFormData(source);
    }
    const controller = controllerRef.current;
    if (!controller) throw new Error("mercado_pago_card_form_unavailable");
    return sanitizeMercadoPagoCardFormData(controller.getCardFormData());
  }, []);

  const finishTokenization = useCallback(
    (source?: MercadoPagoCardFormData | Event | null) => {
      try {
        const card = readTokenizedCardData(source);
        setError(null);
        onTokenizedRef.current(card);
      } catch (tokenError) {
        handleTokenizationError(tokenError);
      } finally {
        setTokenizingState(false);
      }
    },
    [handleTokenizationError, readTokenizedCardData, setTokenizingState],
  );

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    controllerRef.current?.unmount?.();
    controllerRef.current = null;

    if (!publicKey) {
      setError("Pagamento por cartao indisponivel no momento.");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Aguarde o calculo do total do pedido.");
      return;
    }

    loadMercadoPago()
      .then(() => {
        if (cancelled) return;
        if (!window.MercadoPago) throw new Error("mercado_pago_sdk_unavailable");
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        controllerRef.current = mp.cardForm({
          amount: amount.toFixed(2),
          iframe: true,
          form: {
            id: formId,
            cardNumber: {
              id: `${formId}__cardNumber`,
              placeholder: "Numero do cartao",
            },
            expirationDate: {
              id: `${formId}__expirationDate`,
              placeholder: "MM/AA",
            },
            securityCode: {
              id: `${formId}__securityCode`,
              placeholder: "CVV",
            },
            cardholderName: {
              id: `${formId}__cardholderName`,
              placeholder: "Nome impresso no cartao",
            },
            issuer: {
              id: `${formId}__issuer`,
              placeholder: "Banco emissor",
            },
            installments: {
              id: `${formId}__installments`,
              placeholder: "Parcelas",
            },
            identificationType: {
              id: `${formId}__identificationType`,
              placeholder: "Documento",
            },
            identificationNumber: {
              id: `${formId}__identificationNumber`,
              placeholder: "Numero do documento",
            },
            cardholderEmail: {
              id: `${formId}__cardholderEmail`,
              placeholder: "E-mail",
            },
          },
          callbacks: {
            onFormMounted: (mountError: unknown) => {
              if (cancelled) return;
              if (mountError) {
                setError("Pagamento por cartao indisponivel no momento.");
                return;
              }
              setReady(true);
            },
            onSubmit: (event: Event) => {
              event.preventDefault();
              if (cancelled) return;
              finishTokenization(event);
            },
            onCardTokenReceived: (tokenData: MercadoPagoCardFormData) => {
              if (cancelled) return;
              finishTokenization(tokenData);
            },
            onFetching: () => {
              return () => {};
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError("Pagamento por cartao indisponivel no momento.");
      });

    return () => {
      cancelled = true;
      setTokenizingState(false);
      controllerRef.current?.unmount?.();
      controllerRef.current = null;
    };
  }, [amount, finishTokenization, formId, publicKey, setTokenizingState]);

  async function tokenizeCard() {
    if (tokenizingRef.current || disabled) return;
    const controller = controllerRef.current;
    if (!controller) {
      setError("Pagamento por cartao indisponivel no momento.");
      return;
    }
    setTokenizingState(true);
    setError(null);
    try {
      const result = controller.submit ? controller.submit() : controller.createCardToken?.();
      if (!controller.submit && !controller.createCardToken) {
        throw new Error("mercado_pago_card_tokenization_unavailable");
      }
      await Promise.resolve(result);
    } catch (tokenError) {
      handleTokenizationError(tokenError);
      setTokenizingState(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CreditCard className="h-4 w-4" />
        Cartao de credito
      </div>
      <form id={formId} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Numero do cartao</Label>
          <div
            id={`${formId}__cardNumber`}
            className="h-10 rounded-md border bg-background px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Validade</Label>
            <div
              id={`${formId}__expirationDate`}
              className="h-10 rounded-md border bg-background px-3 py-2"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>CVV</Label>
            <div
              id={`${formId}__securityCode`}
              className="h-10 rounded-md border bg-background px-3 py-2"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${formId}__cardholderName`}>Nome impresso no cartao</Label>
          <Input id={`${formId}__cardholderName`} autoComplete="cc-name" disabled={disabled} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}__identificationType`}>Documento</Label>
            <select
              id={`${formId}__identificationType`}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              disabled={disabled}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}__identificationNumber`}>Numero</Label>
            <Input id={`${formId}__identificationNumber`} inputMode="numeric" disabled={disabled} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}__issuer`}>Banco</Label>
            <select
              id={`${formId}__issuer`}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              disabled={disabled}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}__installments`}>Parcelas</Label>
            <select
              id={`${formId}__installments`}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              disabled={disabled}
            />
          </div>
        </div>
        <input id={`${formId}__cardholderEmail`} type="email" value={payerEmail} readOnly hidden />
        <Button
          type="button"
          variant="outline"
          onClick={tokenizeCard}
          disabled={!ready || tokenizing || disabled}
        >
          {tokenizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Validar cartao
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
