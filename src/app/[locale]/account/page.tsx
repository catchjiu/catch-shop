"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShopClientWrapper } from "@/app/[locale]/shop/ShopClientWrapper";
import { formatTWD } from "@/lib/currency";
import { User, Package, Save, LogOut, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  is_preorder_order: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "text-amber-400 bg-amber-400/10",
  processing: "text-blue-400 bg-blue-400/10",
  shipped: "text-purple-400 bg-purple-400/10",
  ready_for_pickup: "text-cyan-400 bg-cyan-400/10",
  completed: "text-green-400 bg-green-400/10",
  cancelled: "text-red-400 bg-red-400/10",
};

export default function AccountPage() {
  const locale = useLocale();
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"orders" | "profile">("orders");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(`/${locale}/auth/login`); return; }
      setUser(user);

      const meta = user.user_metadata ?? {};
      setFullName(meta.full_name ?? "");
      setPhone(meta.phone ?? "");
      setAddress(meta.address ?? "");
      setCity(meta.city ?? "");
      setZip(meta.zip ?? "");

      const { data } = await supabase
        .from("orders")
        .select("id, created_at, total_amount, status, is_preorder_order")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders((data ?? []) as Order[]);
      setLoading(false);
    };
    load();
  }, [locale, router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone, address, city, zip, country: "TW" },
      });
      if (error) { toast.error("Failed to save profile."); return; }
      toast.success("Profile updated.");
    } catch { toast.error("Something went wrong."); }
    finally { setSaving(false); }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/shop`);
    router.refresh();
  };

  if (loading) {
    return (
      <ShopClientWrapper>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      </ShopClientWrapper>
    );
  }

  return (
    <ShopClientWrapper>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Account</h1>
            <p className="mt-0.5 text-sm text-white/40">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/40 hover:border-white/20 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {(["orders", "profile"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                tab === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70",
              ].join(" ")}
            >
              {t === "orders" ? <Package className="h-4 w-4" /> : <User className="h-4 w-4" />}
              {t === "orders" ? "Orders" : "Profile"}
            </button>
          ))}
        </div>

        {/* Orders tab */}
        {tab === "orders" && (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 py-16 text-center">
                <Package className="mx-auto h-10 w-10 text-white/20" />
                <p className="mt-3 text-sm text-white/30">No orders yet.</p>
                <Link href={`/${locale}/shop`} className="mt-4 inline-block text-sm text-white underline underline-offset-2">
                  Start shopping
                </Link>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-white/40">
                      {new Date(order.created_at).toLocaleDateString(locale === "zh-TW" ? "zh-TW" : "en-US", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                      {order.is_preorder_order && <span className="ml-2 text-amber-400">Preorder</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_COLORS[order.status] ?? "text-white/50 bg-white/5"}`}>
                      {order.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {formatTWD(order.total_amount, locale)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-white/20" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Profile tab */}
        {tab === "profile" && (
          <form onSubmit={handleSaveProfile} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dan Reid"
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+886 912 345 678"
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-white/50">Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street"
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)}
                  placeholder="Taipei"
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">ZIP Code</Label>
                <Input value={zip} onChange={(e) => setZip(e.target.value)}
                  placeholder="10001"
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
            </div>
            <div className="border-t border-white/10 pt-4">
              <Button type="submit" disabled={saving} className="bg-white font-semibold text-slate-900 hover:bg-white/90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save Profile</>}
              </Button>
            </div>
          </form>
        )}
      </main>
    </ShopClientWrapper>
  );
}
