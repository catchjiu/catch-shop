"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, KeyRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatTWD } from "@/lib/currency";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface OrderInfo {
  id: string;
  total_amount: number;
  status: string;
  payment_method: string;
  is_preorder_order: boolean;
  shipping_email: string | null;
  guest_email: string | null;
  created_at: string;
}

interface SuccessClientProps {
  order: OrderInfo | null;
  isGuest: boolean;
  guestEmail: string;
  locale: string;
}

export function SuccessClient({ order, isGuest, guestEmail, locale }: SuccessClientProps) {
  const t = useTranslations("success");
  const [password, setPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  const handleCreateAccount = async () => {
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setIsCreating(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: guestEmail,
        password,
        options: {
          data: { role: "customer" },
        },
      });
      if (error) throw error;

      // Link any guest orders to the new account via API route
      if (data.user) {
        await fetch("/api/auth/link-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.user.id, email: guestEmail }),
        });
      }

      setAccountCreated(true);
      toast.success(
        locale === "zh-TW"
          ? "帳戶已建立！請查看您的電子郵件以完成驗證。"
          : "Account created! Check your email to verify.",
        { duration: 6000 }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setIsCreating(false);
    }
  };

  if (!order) return null;

  return (
    <div className="mt-6 space-y-6">
      {/* Bank transfer details */}
      {order.payment_method === "manual_bank_transfer" && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6 space-y-4">
          <div className="flex items-center gap-2 text-blue-300">
            <Building2 className="h-5 w-5" />
            <h3 className="font-semibold">{t("bankDetails.title")}</h3>
          </div>
          <Separator className="bg-blue-500/20" />
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-white/50">{t("bankDetails.bank")}</dt>
              <dd className="text-white">{t("bankDetails.bankName")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/50">{t("bankDetails.account")}</dt>
              <dd className="font-mono text-white">{t("bankDetails.accountNumber")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/50">{t("bankDetails.accountName")}</dt>
              <dd className="text-white">{t("bankDetails.accountHolder")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/50">{t("bankDetails.amount")}</dt>
              <dd className="text-lg font-bold text-white">
                {formatTWD(order.total_amount, locale)}
              </dd>
            </div>
          </dl>
          <p className="rounded-lg bg-blue-500/10 p-3 text-xs text-blue-300/80">
            {t("bankDetails.note")}
          </p>
        </div>
      )}

      {/* NewebPay redirecting */}
      {order.payment_method === "newebpay" && order.status === "pending_payment" && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t("newebpay.redirecting")}
        </div>
      )}

      {/* Guest → Create account */}
      {isGuest && !accountCreated && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center gap-2 text-white">
            <UserPlus className="h-5 w-5" />
            <h3 className="font-semibold">{t("createAccount.title")}</h3>
          </div>
          <p className="text-sm text-white/50">{t("createAccount.subtitle")}</p>
          <div>
            <Label className="mb-1.5 block text-xs text-white/60">
              {t("createAccount.password")}
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-white/20 bg-white/5 pl-9 text-white placeholder:text-white/30"
              />
            </div>
          </div>
          <Button
            onClick={handleCreateAccount}
            disabled={isCreating}
            className="w-full bg-white text-slate-900 hover:bg-white/90 font-semibold"
          >
            {isCreating
              ? locale === "zh-TW"
                ? "建立中..."
                : "Creating..."
              : t("createAccount.submit")}
          </Button>
        </div>
      )}

      {accountCreated && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-center text-sm text-green-300">
          {locale === "zh-TW"
            ? "帳戶建立成功！請查看電子郵件以完成驗證。"
            : "Account created! Please check your email to verify your account."}
        </div>
      )}
    </div>
  );
}
