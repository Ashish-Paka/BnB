import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);

  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  useEffect(() => {
    // Check if already running as installed webapp
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Close iOS tip when clicking outside
  useEffect(() => {
    if (!showIOSTip) return;
    const handler = (e: MouseEvent) => {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) {
        setShowIOSTip(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showIOSTip]);

  // Hide if already installed or no install available and not iOS
  if (isStandalone) return null;
  if (!deferredPrompt && !isIOS) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSTip(!showIOSTip);
    }
  };

  return (
    <div className="relative" ref={tipRef}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleClick}
        className="p-3 md:p-4 rounded-full bg-white/80 dark:bg-stone-900/80 backdrop-blur-md shadow-sm border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:shadow-md transition-all"
        title="Add to Home Screen"
      >
        <Smartphone className="w-5 h-5 md:w-6 md:h-6" />
      </motion.button>

      {/* iOS instruction tooltip */}
      <AnimatePresence>
        {showIOSTip && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-300 dark:border-stone-700 p-4 z-50"
          >
            <button
              onClick={() => setShowIOSTip(false)}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X className="w-3.5 h-3.5 text-stone-400" />
            </button>
            <p className="font-bold text-sm text-stone-800 dark:text-stone-200 mb-2">
              Add to Home Screen
            </p>
            <ol className="text-xs text-stone-500 dark:text-stone-400 space-y-1.5 list-decimal list-inside">
              <li>
                Tap the <strong>Share</strong> button
                <span className="inline-block mx-1 text-base align-middle">&#61640;</span>
                in Safari
              </li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong> to confirm</li>
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
