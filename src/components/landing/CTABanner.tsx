import { motion } from "motion/react";
import { Coffee, PawPrint, ExternalLink } from "lucide-react";

interface Props {
  shopUrl?: string;
  shopText?: string;
  shopEnabled?: boolean;
}

export default function CTABanner({ shopUrl = "https://bonesandbru.com/", shopText = "Visit Bonesandbru.com", shopEnabled = true }: Props) {
  if (!shopEnabled) return null;

  return (
    <motion.a
      href={shopUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="block w-full cursor-pointer hover:scale-[1.02] active:scale-[0.98] mb-5 md:mb-7 p-6 sm:p-8 rounded-[3rem] bg-brand-olive text-white shadow-[0_20px_50px_-12px_rgba(132,204,22,0.4)] relative overflow-hidden group border border-white/20 transition-all"
    >
      {/* Background decorations */}
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 group-hover:rotate-12 transition-all duration-700 pointer-events-none">
        <Coffee className="w-28 h-28" />
      </div>
      <div className="absolute bottom-0 left-0 p-6 opacity-10 group-hover:scale-125 group-hover:-rotate-12 transition-all duration-700 pointer-events-none">
        <PawPrint className="w-24 h-24" />
      </div>

      <div className="relative z-10 flex items-center gap-3 sm:gap-5">
        {/* Shop cart logo in circle frame on the left */}
        <div className="shrink-0">
          <div className="bg-white/20 rounded-full p-1.5 sm:p-2 backdrop-blur-sm">
            <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-[76px] md:h-[76px] rounded-full bg-white flex items-center justify-center">
              <img src="/shop.png" alt="" className="w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain" />
            </div>
          </div>
        </div>

        {/* Text content on the right */}
        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-black mb-2 leading-snug drop-shadow-md" style={{ fontSize: "clamp(1rem, 4.5vw, 1.75rem)" }}>
            {shopText}
          </h3>
          <div className="inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white text-brand-olive px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 rounded-full font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
            <span>Shop Online</span>
            <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          </div>
        </div>
      </div>
    </motion.a>
  );
}
