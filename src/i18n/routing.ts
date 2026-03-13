import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh-TW"],
  defaultLocale: "en",
  pathnames: {
    "/": "/",
    "/shop": "/shop",
    "/shop/[slug]": "/shop/[slug]",
    "/checkout": "/checkout",
    "/checkout/success": "/checkout/success",
    "/auth/login": "/auth/login",
    "/auth/register": "/auth/register",
    "/account": "/account",
  },
});
