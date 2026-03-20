import { useState } from "react";
import { motion } from "motion/react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { ownerLogin } from "../lib/api";

interface Props {
  onLogin: (token: string) => void;
}

export default function DashboardLoginPage({ onLogin }: Props) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await ownerLogin(password);
      localStorage.setItem("owner_token", res.token);
      onLogin(res.token);
    } catch {
      setError("Invalid password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md rounded-3xl shadow-xl border border-stone-200/50 dark:border-stone-700/50 p-8">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full bg-brand-orange/10 flex items-center justify-center">
              <Lock className="w-7 h-7 text-brand-orange" />
            </div>
          </div>

          <h1 className="font-serif text-2xl font-black text-center text-stone-800 dark:text-stone-200 mb-6">
            Owner Dashboard
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-sm font-medium text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-orange text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
