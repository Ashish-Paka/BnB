import { motion } from "motion/react";
import { Coffee, ShoppingBag, CheckCircle2, Flame } from "lucide-react";

interface Props {
  onOpen: () => void;
  itemCount: number;
  orderStatus?: string | null;
  orderingEnabled: boolean;
}

export default function InCafeBanner({ onOpen, itemCount, orderStatus, orderingEnabled }: Props) {
  const hasActiveOrder = !!orderStatus && orderStatus !== "completed";

  const statusSteps = [
    { key: "pending", label: "Received", icon: CheckCircle2 },
    { key: "preparing", label: "Preparing", icon: Flame },
    { key: "ready", label: "Ready", icon: Coffee },
  ];
  const statusOrder = ["pending", "preparing", "ready", "completed"];
  const currentIdx = statusOrder.indexOf(orderStatus || "");

  return (
    <motion.button
      onClick={onOpen}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="block w-full text-left cursor-pointer hover:scale-[1.02] active:scale-[0.98] mb-5 md:mb-7 p-6 sm:p-8 rounded-[3rem] bg-gradient-to-br from-brand-orange via-brand-pink to-brand-orange bg-[length:200%_200%] animate-gradient text-white shadow-[0_20px_50px_-12px_rgba(236,72,153,0.4)] relative overflow-hidden group border border-white/20 transition-all"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 group-hover:rotate-12 transition-all duration-700 pointer-events-none">
        <Coffee className="w-28 h-28" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl sm:text-2xl md:text-3xl font-black mb-1 drop-shadow-md">
              {hasActiveOrder ? "Your Order" : orderingEnabled ? "Place Order" : "Menu"}
            </h3>
            <p className="text-white/90 text-sm sm:text-base font-medium drop-shadow-sm">
              {hasActiveOrder ? "Tap to order more" : orderingEnabled ? "Order ahead from our in-cafe menu" : "Browse our full menu"}
            </p>
          </div>
          <div className="relative">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <ShoppingBag className="w-7 h-7" />
            </div>
            {itemCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-white text-brand-orange rounded-full text-xs font-black flex items-center justify-center shadow"
              >
                {itemCount}
              </motion.span>
            )}
          </div>
        </div>

        {/* Inline order status tracker */}
        {hasActiveOrder && (
          <div className="flex items-center justify-center gap-0 mt-4 pt-4 border-t border-white/20">
            {statusSteps.map((step, i) => {
              const stepIdx = statusOrder.indexOf(step.key);
              const isActive = currentIdx >= stepIdx;
              const isCurrent = step.key === orderStatus;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center">
                  {i > 0 && (
                    <div
                      className={`w-6 sm:w-10 h-0.5 transition-colors duration-500 ${
                        isActive ? "bg-white" : "bg-white/25"
                      }`}
                    />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <motion.div
                      animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                      transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors duration-500 ${
                        isActive
                          ? "bg-white text-brand-orange"
                          : "bg-white/20 text-white/50"
                      }`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.div>
                    <span
                      className={`text-[10px] sm:text-xs font-bold transition-colors duration-500 ${
                        isActive ? "text-white" : "text-white/40"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.button>
  );
}
