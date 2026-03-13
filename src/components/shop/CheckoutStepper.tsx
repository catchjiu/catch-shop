"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/useCart";
import { formatTWD } from "@/lib/currency";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod } from "@/lib/supabase/types";

type Step = "shipping" | "payment" | "review";

interface ShippingData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  country: string;
}

const STEPS: Step[] = ["shipping", "payment", "review"];

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export function CheckoutStepper() {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const router = useRouter();
  const { items, getTotalAmount, hasPreorderItems, clearCart } = useCart();

  const [currentStep, setCurrentStep] = useState<Step>("shipping");
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [shipping, setShipping] = useState<ShippingData>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    zip: "",
    country: "TW",
  });

  // Pre-fill from logged-in user's profile
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const m = user.user_metadata ?? {};
      setShipping((prev) => ({
        ...prev,
        fullName: m.full_name ?? prev.fullName,
        email: user.email ?? prev.email,
        phone: m.phone ?? prev.phone,
        address: m.address ?? prev.address,
        city: m.city ?? prev.city,
        zip: m.zip ?? prev.zip,
        country: m.country ?? prev.country,
      }));
    });
  }, []);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("manual_bank_transfer");
  const [bankLastFive, setBankLastFive] = useState("");
  const [preorderConfirmed, setPreorderConfirmed] = useState(false);
  const [errors, setErrors] = useState<Partial<ShippingData & { preorder: boolean; bankLastFive: string }>>({});

  const totalAmount = getTotalAmount();
  const hasPreorder = hasPreorderItems();

  const stepIndex = STEPS.indexOf(currentStep);

  const navigateStep = (next: Step) => {
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setCurrentStep(next);
  };

  const validateShipping = (): boolean => {
    const newErrors: Partial<ShippingData> = {};
    if (!shipping.fullName.trim()) newErrors.fullName = t("errors.required");
    if (!shipping.email.trim()) {
      newErrors.email = t("errors.required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email)) {
      newErrors.email = t("errors.invalidEmail");
    }
    if (!shipping.address.trim()) newErrors.address = t("errors.required");
    if (!shipping.city.trim()) newErrors.city = t("errors.required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleShippingNext = () => {
    if (validateShipping()) navigateStep("payment");
  };

  const handlePaymentNext = () => {
    if (paymentMethod === "manual_bank_transfer") {
      if (!bankLastFive.trim() || !/^\d{5}$/.test(bankLastFive)) {
        setErrors((e) => ({ ...e, bankLastFive: locale === "zh-TW" ? "請輸入帳號末五碼（數字）" : "Please enter the last 5 digits of your account number." }));
        return;
      }
    }
    setErrors((e) => { const { bankLastFive: _, ...rest } = e; return rest; });
    navigateStep("review");
  };

  const handleSubmit = async () => {
    if (hasPreorder && !preorderConfirmed) {
      setErrors((e) => ({ ...e, preorder: true }));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping,
          paymentMethod,
          bankLastFive: paymentMethod === "manual_bank_transfer" ? bankLastFive : undefined,
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            price: i.price,
          })),
          totalAmount,
          isPreorderOrder: hasPreorder,
          locale,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Order failed");
      }

      const data = await res.json();

      if (paymentMethod === "newebpay" && data.newebpayForm) {
        // Submit NewebPay form
        const formContainer = document.createElement("div");
        formContainer.innerHTML = data.newebpayForm;
        document.body.appendChild(formContainer);
        const form = formContainer.querySelector("form") as HTMLFormElement;
        if (form) form.submit();
        return;
      }

      clearCart();
      // Silently update the user's saved profile with the latest shipping info
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.auth.updateUser({
            data: {
              full_name: shipping.fullName,
              phone: shipping.phone,
              address: shipping.address,
              city: shipping.city,
              zip: shipping.zip,
              country: shipping.country,
            },
          });
        }
      } catch { /* non-critical */ }
      router.push(`/checkout/success?orderId=${data.orderId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step indicator */}
      <div className="mb-10 flex items-center justify-center gap-0">
        {STEPS.map((step, idx) => (
          <div key={step} className="flex items-center">
            <div
              className={[
                "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                idx < stepIndex
                  ? "border-white bg-white text-slate-900"
                  : idx === stepIndex
                  ? "border-white bg-transparent text-white"
                  : "border-white/20 bg-transparent text-white/30",
              ].join(" ")}
            >
              {idx < stepIndex ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <span
              className={[
                "ml-2 text-sm font-medium",
                idx === stepIndex ? "text-white" : "text-white/40",
              ].join(" ")}
            >
              {t(`steps.${step}`)}
            </span>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="mx-3 h-4 w-4 text-white/20" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-sm min-h-[360px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {currentStep === "shipping" && (
              <ShippingStep
                data={shipping}
                errors={errors}
                onChange={(field, val) =>
                  setShipping((s) => ({ ...s, [field]: val }))
                }
                onNext={handleShippingNext}
                t={t}
              />
            )}

            {currentStep === "payment" && (
              <PaymentStep
                value={paymentMethod}
                onChange={(v) => { setPaymentMethod(v); setBankLastFive(""); setErrors((e) => { const { bankLastFive: _, ...rest } = e; return rest; }); }}
                bankLastFive={bankLastFive}
                onBankLastFiveChange={setBankLastFive}
                bankLastFiveError={errors.bankLastFive}
                onBack={() => navigateStep("shipping")}
                onNext={handlePaymentNext}
                t={t}
              />
            )}

            {currentStep === "review" && (
              <ReviewStep
                shipping={shipping}
                paymentMethod={paymentMethod}
                bankLastFive={bankLastFive}
                items={items}
                totalAmount={totalAmount}
                hasPreorder={hasPreorder}
                preorderConfirmed={preorderConfirmed}
                setPreorderConfirmed={setPreorderConfirmed}
                preorderError={errors.preorder}
                onBack={() => navigateStep("payment")}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                locale={locale}
                t={t}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ShippingStepProps {
  data: ShippingData;
  errors: Partial<ShippingData>;
  onChange: (field: keyof ShippingData, value: string) => void;
  onNext: () => void;
  t: ReturnType<typeof useTranslations<"checkout">>;
}

function ShippingStep({ data, errors, onChange, onNext, t }: ShippingStepProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">{t("steps.shipping")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={t("shipping.fullName")}
          error={errors.fullName}
          className="sm:col-span-2"
        >
          <Input
            value={data.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
            className="border-white/20 bg-white/5 text-white placeholder:text-white/30"
            placeholder="Chen Wei-Lin"
          />
        </FormField>
        <FormField label={t("shipping.email")} error={errors.email}>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            className="border-white/20 bg-white/5 text-white placeholder:text-white/30"
            placeholder="you@email.com"
          />
        </FormField>
        <FormField label={t("shipping.phone")}>
          <Input
            type="tel"
            value={data.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            className="border-white/20 bg-white/5 text-white placeholder:text-white/30"
            placeholder="+886 912 345 678"
          />
        </FormField>
        <FormField
          label={t("shipping.address")}
          error={errors.address}
          className="sm:col-span-2"
        >
          <Input
            value={data.address}
            onChange={(e) => onChange("address", e.target.value)}
            className="border-white/20 bg-white/5 text-white placeholder:text-white/30"
            placeholder="123 Jianguo North Road, Section 2"
          />
        </FormField>
        <FormField label={t("shipping.city")} error={errors.city}>
          <Input
            value={data.city}
            onChange={(e) => onChange("city", e.target.value)}
            className="border-white/20 bg-white/5 text-white placeholder:text-white/30"
            placeholder="Taipei City"
          />
        </FormField>
        <FormField label={t("shipping.zip")}>
          <Input
            value={data.zip}
            onChange={(e) => onChange("zip", e.target.value)}
            className="border-white/20 bg-white/5 text-white placeholder:text-white/30"
            placeholder="10491"
          />
        </FormField>
      </div>
      <Button
        onClick={onNext}
        className="w-full bg-white text-slate-900 hover:bg-white/90 font-semibold"
      >
        {t("steps.payment")} →
      </Button>
    </div>
  );
}

interface PaymentStepProps {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
  bankLastFive: string;
  onBankLastFiveChange: (v: string) => void;
  bankLastFiveError?: string;
  onBack: () => void;
  onNext: () => void;
  t: ReturnType<typeof useTranslations<"checkout">>;
}

function PaymentStep({ value, onChange, bankLastFive, onBankLastFiveChange, bankLastFiveError, onBack, onNext, t }: PaymentStepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">{t("payment.title")}</h2>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as PaymentMethod)}
        className="space-y-3"
      >
        {(
          [
            {
              id: "manual_bank_transfer" as PaymentMethod,
              title: t("payment.bankTransfer"),
              desc: t("payment.bankTransferDesc"),
            },
            {
              id: "newebpay" as PaymentMethod,
              title: t("payment.newebpay"),
              desc: t("payment.newebpayDesc"),
            },
          ] as const
        ).map((opt) => (
          <label
            key={opt.id}
            htmlFor={opt.id}
            className={[
              "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all",
              value === opt.id
                ? "border-white/40 bg-white/10"
                : "border-white/10 hover:border-white/20",
            ].join(" ")}
          >
            <RadioGroupItem value={opt.id} id={opt.id} className="mt-0.5" />
            <div>
              <p className="font-medium text-white">{opt.title}</p>
              <p className="mt-1 text-sm text-white/50">{opt.desc}</p>
            </div>
          </label>
        ))}
      </RadioGroup>

      {/* Last 5 digits field — only shown for bank transfer */}
      {value === "manual_bank_transfer" && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
          <p className="text-sm text-blue-300/80">
            {locale === "zh-TW"
              ? "請輸入您付款帳號的末五碼，方便我們核對款項。"
              : "Enter the last 5 digits of the bank account you'll transfer from so we can match your payment."}
          </p>
          <FormField
            label={locale === "zh-TW" ? "帳號末五碼" : "Last 5 digits of your account"}
            error={bankLastFiveError}
          >
            <Input
              value={bankLastFive}
              onChange={(e) => onBankLastFiveChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
              maxLength={5}
              inputMode="numeric"
              placeholder="12345"
              className="border-white/20 bg-white/5 text-white placeholder:text-white/20 tracking-widest text-lg w-36 font-mono"
            />
          </FormField>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 border-white/20 text-white/70 hover:border-white/40 hover:text-white"
        >
          ← {t("steps.shipping")}
        </Button>
        <Button
          onClick={onNext}
          className="flex-1 bg-white text-slate-900 hover:bg-white/90 font-semibold"
        >
          {t("steps.review")} →
        </Button>
      </div>
    </div>
  );
}

interface ReviewStepProps {
  shipping: ShippingData;
  paymentMethod: PaymentMethod;
  bankLastFive: string;
  items: ReturnType<typeof useCart>["items"] extends () => infer R ? R : never[];
  totalAmount: number;
  hasPreorder: boolean;
  preorderConfirmed: boolean;
  setPreorderConfirmed: (v: boolean) => void;
  preorderError: boolean | undefined;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  locale: string;
  t: ReturnType<typeof useTranslations<"checkout">>;
}

function ReviewStep({
  shipping,
  paymentMethod,
  bankLastFive,
  items,
  totalAmount,
  hasPreorder,
  preorderConfirmed,
  setPreorderConfirmed,
  preorderError,
  onBack,
  onSubmit,
  isSubmitting,
  locale,
  t,
}: ReviewStepProps) {
  const tCommon = useTranslations("common");
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">{t("review.title")}</h2>

      {/* Shipping summary */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm space-y-1">
        <p className="font-medium text-white">{shipping.fullName}</p>
        <p className="text-white/60">{shipping.email}</p>
        <p className="text-white/60">
          {shipping.address}, {shipping.city} {shipping.zip}
        </p>
        {paymentMethod === "manual_bank_transfer" && bankLastFive && (
          <p className="mt-2 pt-2 border-t border-white/10 text-white/50">
            {locale === "zh-TW" ? "帳號末五碼" : "Account last 5 digits"}:{" "}
            <span className="font-mono font-semibold text-white/80 tracking-widest">{bankLastFive}</span>
          </p>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => {
          const name = locale === "zh-TW" ? item.nameZh : item.nameEn;
          return (
            <div key={item.variantId} className="flex justify-between text-sm">
              <span className="text-white/70">
                {name} × {item.quantity} ({item.size})
              </span>
              <span className="text-white">
                {formatTWD(item.price * item.quantity, locale)}
              </span>
            </div>
          );
        })}
        <Separator className="my-2 bg-white/10" />
        <div className="flex justify-between font-bold">
          <span className="text-white">{t("review.total")}</span>
          <span className="text-lg text-white">{formatTWD(totalAmount, locale)}</span>
        </div>
      </div>

      {/* Preorder confirmation */}
      {hasPreorder && (
        <button
          type="button"
          onClick={() => setPreorderConfirmed((v) => !v)}
          className={[
            "w-full rounded-xl border-2 p-4 text-left transition-all",
            preorderConfirmed
              ? "border-amber-400 bg-amber-400/15"
              : preorderError
              ? "border-red-500 bg-red-500/10"
              : "border-amber-500/40 bg-amber-500/8 hover:border-amber-400/70",
          ].join(" ")}
        >
          <div className="flex items-start gap-4">
            {/* Big visible checkbox */}
            <span
              className={[
                "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all",
                preorderConfirmed
                  ? "border-amber-400 bg-amber-400"
                  : preorderError
                  ? "border-red-500 bg-transparent"
                  : "border-amber-500/60 bg-transparent",
              ].join(" ")}
              aria-hidden
            >
              {preorderConfirmed && (
                <svg viewBox="0 0 12 10" className="h-3.5 w-3.5" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 5 4.5 9 11 1" />
                </svg>
              )}
            </span>

            <span className={[
              "text-sm leading-relaxed font-medium",
              preorderConfirmed ? "text-amber-300" : preorderError ? "text-red-300" : "text-amber-400/80",
            ].join(" ")}>
              {t("review.preorderConfirm")}
            </span>
          </div>
          {preorderError && (
            <p className="mt-3 pl-10 text-xs font-semibold text-red-400">
              ↑ {t("errors.preorderRequired")}
            </p>
          )}
        </button>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 border-white/20 text-white/70 hover:border-white/40 hover:text-white"
        >
          ← {t("steps.payment")}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-white text-slate-900 hover:bg-white/90 font-semibold"
        >
          {isSubmitting ? tCommon("loading") : t("review.placeOrder")}
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FormField({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-white/60">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
