// Only allow paths inside this site, never another address
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}