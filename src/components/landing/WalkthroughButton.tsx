import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, X } from "lucide-react";
import { getWalkthroughVideoUrl } from "../../lib/api";

interface Props {
  walkthroughEnabled?: boolean;
  hasCustomVideo?: boolean;
}

export default function WalkthroughButton({ walkthroughEnabled = true, hasCustomVideo }: Props) {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const videoSrc = hasCustomVideo ? getWalkthroughVideoUrl() : "/video.mp4";

  if (!walkthroughEnabled) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="w-full flex justify-center mb-12 md:mb-16"
      >
        <button
          onClick={() => setShowVideoModal(true)}
          className="w-full sm:max-w-md inline-flex items-center justify-center gap-3 bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-4 md:px-10 md:py-5 rounded-full font-bold text-lg md:text-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 hover:scale-105 active:scale-95 border-2 border-white/20 dark:border-stone-700/50"
        >
          <Play className="w-6 h-6 md:w-7 md:h-7 fill-current" />
          <span>Virtual Walkthrough</span>
        </button>
      </motion.div>

      {/* Video Modal */}
      <AnimatePresence>
        {showVideoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-brand-pink rounded-full text-white transition-colors z-10"
            >
              <X className="w-8 h-8" />
            </button>
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative w-full max-w-4xl aspect-[9/16] sm:aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            >
              <video
                src={videoSrc}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
