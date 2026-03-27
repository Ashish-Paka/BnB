import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Gift, LogIn, Heart, LogOut, ClipboardList } from "lucide-react";
import CircularProgress from "../ui/CircularProgress";
import Modal from "../ui/Modal";
import RewardsLogin from "./RewardsLogin";
import VerifyVisit from "./VerifyVisit";
import OrderHistory from "./OrderHistory";
import type { Customer } from "../../lib/types";
import { REWARD_THRESHOLD } from "../../lib/constants";

interface Props {
  pendingOtpCode?: string | null;
  onOtpProcessed?: () => void;
  refreshTrigger?: number;
}

export default function RewardsBanner({ pendingOtpCode, onOtpProcessed, refreshTrigger }: Props = {}) {
  const [customer, setCustomer] = useState<Customer | null>(() => {
    try {
      const saved = localStorage.getItem("bnb_customer");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const otpProcessedRef = useRef(false);

  // Re-read customer from localStorage when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === 0) return;
    try {
      const saved = localStorage.getItem("bnb_customer");
      if (saved) setCustomer(JSON.parse(saved));
    } catch {}
  }, [refreshTrigger]);

  // Auto-trigger on pending OTP code from URL
  useEffect(() => {
    if (!pendingOtpCode || otpProcessedRef.current) return;
    otpProcessedRef.current = true;
    setOtpCode(pendingOtpCode);
    if (customer) {
      setShowVerify(true);
    } else {
      setShowLogin(true);
    }
  }, [pendingOtpCode, customer]);

  const handleLogin = (c: Customer) => {
    setCustomer(c);
    localStorage.setItem("bnb_customer", JSON.stringify(c));
    setShowLogin(false);
    if (otpCode) {
      setTimeout(() => setShowVerify(true), 300);
    }
  };

  const handleVerified = (visitCount: number, rewardEarned: boolean) => {
    if (customer) {
      const updated = {
        ...customer,
        visit_count: visitCount,
        rewards_earned: rewardEarned
          ? customer.rewards_earned + 1
          : customer.rewards_earned,
      };
      setCustomer(updated);
      localStorage.setItem("bnb_customer", JSON.stringify(updated));
    }
    setShowVerify(false);
    setOtpCode(null);
    onOtpProcessed?.();
    if (rewardEarned) {
      setCelebration(true);
      setTimeout(() => setCelebration(false), 3000);
    }
  };

  const handleRedeemed = (rewardsRemaining: number) => {
    if (customer) {
      const updated = {
        ...customer,
        rewards_redeemed: customer.rewards_redeemed + 1,
      };
      setCustomer(updated);
      localStorage.setItem("bnb_customer", JSON.stringify(updated));
    }
    setShowRedeem(false);
    setOtpCode(null);
    onOtpProcessed?.();
  };

  const handleLogout = () => {
    setCustomer(null);
    localStorage.removeItem("bnb_customer");
  };

  const availableRewards =
    customer ? customer.rewards_earned - customer.rewards_redeemed : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="w-full mb-5 md:mb-7 p-6 sm:p-8 rounded-[3rem] bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 bg-[length:200%_200%] animate-gradient text-white shadow-[0_20px_50px_-12px_rgba(245,158,11,0.4)] relative overflow-hidden border border-white/20"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Gift className="w-32 h-32" />
        </div>
        <div className="absolute bottom-0 left-0 p-4 opacity-10 pointer-events-none">
          <Heart className="w-24 h-24" />
        </div>

        <div className="relative z-10 flex items-center gap-3 sm:gap-5">
          {/* Progress ring */}
          <div className="shrink-0">
            <div className="bg-white/20 rounded-full p-1.5 sm:p-2 backdrop-blur-sm">
              <CircularProgress
                current={customer?.visit_count ?? 0}
                total={REWARD_THRESHOLD}
                size={68}
              />
            </div>
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg sm:text-xl md:text-2xl font-black mb-0.5 drop-shadow-md">
              Rewards
            </h3>
            {customer ? (
              <>
                <p className="text-white text-sm sm:text-base font-semibold mb-0.5 break-words">
                  {customer.names[0]}
                </p>
                <p className="text-white/90 text-xs sm:text-sm font-medium mb-2">
                  {customer.visit_count}/{REWARD_THRESHOLD} visits
                  {availableRewards > 0 && (
                    <span className="ml-2 bg-white/30 px-2 py-0.5 rounded-full text-xs font-bold">
                      {availableRewards} free drink{availableRewards > 1 ? "s" : ""}!
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {availableRewards > 0 && (
                    <button
                      onClick={() => setShowRedeem(true)}
                      className="inline-flex items-center gap-1.5 bg-white text-green-600 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:scale-95 ring-2 ring-green-300/50"
                    >
                      <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Redeem
                    </button>
                  )}
                  <button
                    onClick={() => setShowVerify(true)}
                    className="inline-flex items-center gap-1.5 bg-white text-amber-600 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Verify Visit
                  </button>
                  <button
                    onClick={() => setShowHistory(true)}
                    className="inline-flex items-center gap-1.5 bg-white/20 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm backdrop-blur-sm hover:bg-white/30 transition-all active:scale-95"
                  >
                    <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Orders
                  </button>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-red-500/80 hover:bg-red-600 text-white text-xs sm:text-sm font-bold transition-all"
                    title="Log out"
                  >
                    <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-white/90 text-sm sm:text-base font-medium mb-3">
                  Earn a free drink every {REWARD_THRESHOLD} visits!
                </p>
                <button
                  onClick={() => setShowLogin(true)}
                  className="inline-flex items-center gap-2 bg-white text-amber-600 px-5 py-2.5 rounded-full font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
                  Log in to track
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Login Modal */}
      <Modal open={showLogin} onClose={() => setShowLogin(false)} title="Track Your Rewards">
        <RewardsLogin onSuccess={handleLogin} />
      </Modal>

      {/* Verify Visit Modal */}
      <Modal open={showVerify} onClose={() => setShowVerify(false)} title="Verify Your Visit">
        {customer && (
          <VerifyVisit customerId={customer.id} onVerified={handleVerified} initialCode={otpCode || undefined} />
        )}
      </Modal>

      {/* Redeem Reward Modal */}
      <Modal open={showRedeem} onClose={() => setShowRedeem(false)} title="Redeem Free Drink">
        {customer && (
          <VerifyVisit
            customerId={customer.id}
            onVerified={() => {}}
            onRedeemed={handleRedeemed}
            initialCode={otpCode || undefined}
            mode="redeem"
          />
        )}
      </Modal>

      {/* Order History Modal */}
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Recent Orders">
        {customer && <OrderHistory customerId={customer.id} />}
      </Modal>

      {/* Celebration overlay */}
      {celebration && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none"
        >
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
              transition={{ repeat: 3, duration: 0.5 }}
              className="text-8xl mb-4"
            >
              🎉
            </motion.div>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-3xl font-serif font-black text-brand-orange drop-shadow-lg bg-white/90 dark:bg-stone-900/90 px-8 py-4 rounded-3xl"
            >
              Free Drink Earned!
            </motion.p>
          </div>
        </motion.div>
      )}
    </>
  );
}
