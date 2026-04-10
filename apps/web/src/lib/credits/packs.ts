export type CreditPackId = "small" | "medium" | "large";

export interface CreditPackDefinition {
  credits: number;
  priceCents: number;
  label: string;
}

export const CREDIT_PACKS: Record<CreditPackId, CreditPackDefinition> = {
  small: { credits: 100, priceCents: 900, label: "100 fix credits" },
  medium: { credits: 500, priceCents: 3900, label: "500 fix credits" },
  large: { credits: 2000, priceCents: 12900, label: "2000 fix credits" },
};

export const CREDIT_PACK_ORDER: CreditPackId[] = ["small", "medium", "large"];
