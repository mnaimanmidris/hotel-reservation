// One discount that applies to a booking
export type DiscountLine = {
  label: string;
  amount: number;
  promoCodeId?: string;
  code?: string;
};

// What the booking page shows while the customer types a code
export type DiscountPreview = {
  gross: number;
  discount: number;
  total: number;
  lines: { label: string; amount: number }[];
  notes: string[];
  errors: string[];
};