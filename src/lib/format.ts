export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

export function rupeesToPaise(input: string | number): number {
  const n = typeof input === "string" ? parseFloat(input) : input;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function paiseToRupeesString(paise: number): string {
  return (paise / 100).toString();
}
