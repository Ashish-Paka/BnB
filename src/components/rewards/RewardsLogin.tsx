import { useState } from "react";
import { Phone, Mail, User } from "lucide-react";
import { checkRewards } from "../../lib/api";
import type { Customer } from "../../lib/types";

interface Props {
  onSuccess: (customer: Customer) => void;
}

export default function RewardsLogin({ onSuccess }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasContact = phone.trim() || email.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContact) {
      setError("Please enter a phone number or email.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const identifier: { name?: string; phone?: string; email?: string } = {};
      if (name.trim()) identifier.name = name.trim();
      if (phone.trim()) identifier.phone = phone.trim();
      if (email.trim()) identifier.email = email.trim();
      const res = await checkRewards(identifier);
      if (res.customer) {
        onSuccess(res.customer);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Name */}
      <div>
        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 block">
          Name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 block">
          Phone Number
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            inputMode="tel"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 block">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>

      <p className="text-xs text-stone-400 text-center -mt-2">
        Enter phone, email, or both
      </p>

      {error && (
        <p className="text-red-500 text-sm font-medium">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !hasContact}
        className="w-full py-3 rounded-xl bg-brand-orange text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? "Loading..." : "Continue"}
      </button>
    </form>
  );
}
