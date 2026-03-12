import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "zh-TW")) {
    notFound();
  }

  const messages = await getMessages();
  const resolvedLocale = await getLocale();

  return (
    <html lang={resolvedLocale} suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-50 antialiased min-h-screen">
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "bg-slate-900 border border-white/10 text-white",
                description: "text-white/60",
              },
            }}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
