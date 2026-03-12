"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Globe } from "lucide-react";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    router.replace(pathname, { locale: locale === "en" ? "zh-TW" : "en" });
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:border-white/40 hover:text-white transition-all"
    >
      <Globe className="h-3.5 w-3.5" />
      {locale === "en" ? "中文" : "EN"}
    </button>
  );
}
