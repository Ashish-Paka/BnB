import { motion } from "motion/react";
import { Coffee, PawPrint, ExternalLink } from "lucide-react";
import logo from "../../assets/logo.webp";

export default function CTABanner() {
  return (
    <motion.a
      href="https://bonesandbru.com/"
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="block w-full cursor-pointer hover:scale-[1.02] active:scale-[0.98] mb-5 md:mb-7 p-8 sm:p-10 md:p-14 rounded-[3rem] bg-gradient-to-br from-brand-orange via-brand-pink to-brand-orange bg-[length:200%_200%] animate-gradient text-white shadow-[0_20px_50px_-12px_rgba(236,72,153,0.4)] relative overflow-hidden group text-center border border-white/20 transition-all"
    >
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 group-hover:rotate-12 transition-all duration-700 pointer-events-none">
        <Coffee className="w-32 h-32 md:w-48 md:h-48" />
      </div>
      <div className="absolute bottom-0 left-0 p-6 opacity-10 group-hover:scale-125 group-hover:-rotate-12 transition-all duration-700 pointer-events-none">
        <PawPrint className="w-24 h-24 md:w-40 md:h-40" />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center">
        <h3 className="font-serif text-[1.65rem] sm:text-4xl md:text-5xl lg:text-6xl font-black mb-3 md:mb-4 leading-tight drop-shadow-md whitespace-nowrap">
          Visit with your fur baby
        </h3>
        <p className="text-white/95 text-base sm:text-lg md:text-xl font-medium flex items-center justify-center gap-2 mb-8 md:mb-10 drop-shadow-sm">
          to pick up treats and coffee
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 w-full">
          <div className="inline-flex items-center justify-center gap-3 bg-white text-brand-orange px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-base md:text-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden bg-white flex items-center justify-center shrink-0">
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span>Order Online</span>
            <ExternalLink className="w-5 h-5 md:w-6 md:h-6 ml-1" />
          </div>
        </div>
      </div>
    </motion.a>
  );
}
