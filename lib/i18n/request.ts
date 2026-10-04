import "server-only";
import { cookies } from "next/headers";
import { type Locale } from "../constants";
import { toLocale } from "../validation";
import { LOCALE_COOKIE } from "./cookie";

export { LOCALE_COOKIE };

/**
 * Resolves the active locale for server components.
 * Stored in a cookie by the LanguageSwitcher; defaults to English.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return toLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}
