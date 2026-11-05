import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const PHONE_ERROR =
  "Please enter a valid phone number. Start with the country code if it is not a Malaysian number, for example +60123456789.";

// Returns the number in international format (for example +60123456789),
// or null when it is not a real phone number. A number without a country code
// is read as a Malaysian number.
export function normalizePhone(
  input: string,
  defaultCountry: CountryCode = "MY"
): string | null {
  const text = input.trim();
  if (!text) return null;
  const parsed = parsePhoneNumberFromString(text, defaultCountry);
  return parsed && parsed.isValid() ? parsed.number : null;
}