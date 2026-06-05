// Shared Pagou types (client-safe)
export interface PagouCardTokenData {
  token: string;
  brand?: string | null;
  last4?: string | null;
  exp_month?: string | null;
  exp_year?: string | null;
}

export interface CreateSubscriptionInput {
  campaign_id: string;
  plan_id: string;
  token: string;
  card_brand?: string | null;
  card_last4?: string | null;
  exp_month?: string | null;
  exp_year?: string | null;
}

export interface CreatePixTransactionInput {
  campaign_id: string;
  plan_id: string;
  billing_period: string; // "YYYY-MM"
}

export interface SubscriptionProvisional {
  subscription_id: string;
  pagou_subscription_id: string | null;
  status: string;
  next_action: unknown | null;
}
