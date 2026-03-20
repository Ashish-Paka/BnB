import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: Props) {
  return (
    <div className="fixed top-4 right-4 z-[300] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border backdrop-blur-md ${
              toast.type === "success"
                ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                : toast.type === "error"
                  ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                  : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : toast.type === "error" ? (
              <AlertCircle className="w-5 h-5 shrink-0" />
            ) : null}
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 hover:bg-black/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Hook for managing toasts
import { useState, useCallback } from "react";

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastItem["type"] = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}
