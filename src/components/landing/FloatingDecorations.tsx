import { motion } from "motion/react";
import { PawPrint, Bone, Dog } from "lucide-react";

export default function FloatingDecorations() {
  return (
    <>
      {/* Decorative Watercolor Background Elements */}
      <div
        className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-brand-orange/15 dark:bg-brand-orange/5 rounded-full blur-[100px] pointer-events-none"
        style={{ contain: "strict" }}
      />
      <div
        className="fixed top-[20%] right-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-brand-pink/15 dark:bg-brand-pink/5 rounded-full blur-[120px] pointer-events-none"
        style={{ contain: "strict" }}
      />
      <div
        className="fixed bottom-[-10%] left-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-brand-olive/15 dark:bg-brand-olive/5 rounded-full blur-[100px] pointer-events-none"
        style={{ contain: "strict" }}
      />

      {/* Floating Dog Elements */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
        className="fixed top-[10%] left-[5%] md:left-[10%] text-brand-orange/20 dark:text-brand-orange/10 pointer-events-none z-0"
      >
        <PawPrint className="w-16 h-16 md:w-32 md:h-32" />
      </motion.div>
      <motion.div
        animate={{ y: [0, 20, 0], rotate: [0, -15, 15, 0] }}
        transition={{
          repeat: Infinity,
          duration: 10,
          ease: "easeInOut",
          delay: 1,
        }}
        className="fixed bottom-[15%] right-[5%] md:right-[10%] text-brand-pink/20 dark:text-brand-pink/10 pointer-events-none z-0"
      >
        <Bone className="w-16 h-16 md:w-28 md:h-28" />
      </motion.div>

      {/* Animated Dog Catching Ball */}
      <motion.div
        animate={{ x: ["-20vw", "120vw"] }}
        transition={{ duration: 12, ease: "linear", repeat: Infinity }}
        className="fixed bottom-12 left-0 flex items-end gap-3 md:gap-4 z-10 opacity-30 dark:opacity-20 pointer-events-none"
      >
        <motion.div
          animate={{ y: [0, -30, 0], rotate: [0, -5, 5, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Dog className="w-16 h-16 md:w-24 md:h-24 text-brand-pink fill-current" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -50, 0], rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          className="mb-4"
        >
          <div className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-brand-orange shadow-lg" />
        </motion.div>
      </motion.div>
    </>
  );
}
