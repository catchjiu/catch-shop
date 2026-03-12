export function formatTWD(amount: number, locale: string): string {
  if (locale === "zh-TW") {
    return `${amount.toLocaleString("zh-TW")} 元`;
  }
  return `NT$ ${amount.toLocaleString("en-US")}`;
}
