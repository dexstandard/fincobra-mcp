export interface CheckoutClientConfig {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: CheckoutFetch;
}

export type CheckoutFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface CreateCheckoutInvoiceInput {
  amountUsd: number;
  description?: string;
  merchantReference?: string;
  customerEmail?: string;
}

export interface CheckoutInvoiceSummary {
  id: string;
  paymentUrl: string;
  status: string;
  amountUsd: number;
  receivedAmountUsd: number;
  confirmedAmountUsd: number;
  paymentCoverage: string | null;
  remainingAmountUsd: number | null;
  productName: string | null;
  merchantReference: string | null;
}

export interface CheckoutClient {
  createInvoice(
    input: CreateCheckoutInvoiceInput,
  ): Promise<CheckoutInvoiceSummary>;
  getInvoice(invoiceId: string): Promise<CheckoutInvoiceSummary>;
}
