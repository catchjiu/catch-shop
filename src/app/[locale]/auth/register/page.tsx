"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User, Phone, MapPin, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const locale = useLocale();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            address,
            city,
            zip,
            country: "TW",
          },
        },
      });
      if (authError) { setError(authError.message); return; }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <Mail className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Check your email</h2>
          <p className="text-sm text-white/50">
            We sent a confirmation link to <span className="text-white">{email}</span>. Click it to activate your account.
          </p>
          <Link href={`/${locale}/auth/login`}
            className="inline-block mt-4 text-sm text-white/50 underline underline-offset-2 hover:text-white">
            Back to Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href={`/${locale}/shop`} className="text-2xl font-black tracking-tight text-white">
            MATSIDE
          </Link>
          <p className="mt-1 text-sm text-white/40">Create your account</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required
                  placeholder="Dan Reid"
                  className="border-white/20 bg-white/5 pl-9 text-white placeholder:text-white/20" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  className="border-white/20 bg-white/5 pl-9 text-white placeholder:text-white/20" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Password * (min 8 chars)</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  placeholder="••••••••" minLength={8}
                  className="border-white/20 bg-white/5 pl-9 text-white placeholder:text-white/20" />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="mb-3 text-xs text-white/40">Shipping info (saves time at checkout)</p>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+886 912 345 678"
                    className="border-white/20 bg-white/5 pl-9 text-white placeholder:text-white/20" />
                </div>
              </div>

              {/* Address */}
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-white/50">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input value={address} onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main Street"
                    className="border-white/20 bg-white/5 pl-9 text-white placeholder:text-white/20" />
                </div>
              </div>

              {/* City + ZIP */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/50">City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)}
                    placeholder="Taipei"
                    className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/50">ZIP</Label>
                  <Input value={zip} onChange={(e) => setZip(e.target.value)}
                    placeholder="10001"
                    className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
                </div>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-white font-semibold text-slate-900 hover:bg-white/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-white/40">
            Already have an account?{" "}
            <Link href={`/${locale}/auth/login`} className="text-white underline underline-offset-2 hover:text-white/80">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
