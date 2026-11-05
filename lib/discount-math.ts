import { money } from "@/lib/booking-total";
import type { DiscountLine } from "@/lib/discount-types";

function nameOf(line: DiscountLine) {
  return line.code ? `Code ${line.code}` : line.label;
}

// Decides which discounts apply and how much each one takes off.
// "best": only the largest saving applies. "combine": all of them, added together.
// Either way the total never goes below minCharge.
export function chooseDiscounts(args: {
  gross: number;
  candidates: DiscountLine[];
  stacking: "best" | "combine";
  minCharge: number;
}): { applied: DiscountLine[]; notes: string[] } {
  const notes: string[] = [];
  let pool = args.candidates.filter((line) => line.amount > 0);

  if (args.stacking === "best" && pool.length > 1) {
    const best = pool.reduce((a, b) => (b.amount > a.amount ? b : a));
    for (const line of pool) {
      if (line !== best) {
        notes.push(`${nameOf(line)} was not used because a larger saving applies.`);
      }
    }
    pool = [best];
  }

  let room = Math.max(0, money(args.gross - args.minCharge));
  const applied: DiscountLine[] = [];
  for (const line of pool) {
    const amount = Math.min(line.amount, room);
    if (amount <= 0) {
      notes.push(
        `${nameOf(line)} was not used: the total cannot go below RM ${args.minCharge.toFixed(2)}.`
      );
      continue;
    }
    if (amount < line.amount) {
      notes.push(
        `${nameOf(line)} was reduced: the total cannot go below RM ${args.minCharge.toFixed(2)}.`
      );
    }
    applied.push({ ...line, amount: money(amount) });
    room = money(room - amount);
  }

  return { applied, notes };
}