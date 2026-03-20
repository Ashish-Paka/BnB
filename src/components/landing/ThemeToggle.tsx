import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun } from "lucide-react";

interface Props {
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
}

export default function ThemeToggle({ isDarkMode, setIsDarkMode }: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => setIsDarkMode(!isDarkMode)}
      className="absolute top-4 right-4 md:top-8 md:right-8 p-3 md:p-4 rounded-full bg-white/80 dark:bg-stone-900/80 backdrop-blur-md shadow-sm border border-stone-200/50 dark:border-stone-700/50 z-50 text-stone-600 dark:text-stone-400 hover:shadow-md transition-all"
    >
      <AnimatePresence mode="wait">
        {isDarkMode ? (
          <motion.div
            key="sun"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
          >
            <Sun className="w-5 h-5 md:w-6 md:h-6" />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
          >
            <Moon className="w-5 h-5 md:w-6 md:h-6" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
