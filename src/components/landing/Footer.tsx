import { motion } from "motion/react";
import {
  Map,
  ExternalLink,
  PhoneCall,
  Mailbox,
  UserPlus,
} from "lucide-react";

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="text-center pb-8 md:pb-12 w-full"
    >
      {/* Address Bar / Navigate */}
      <motion.a
        href="https://maps.app.goo.gl/Ztxx4ZxxPG5SRg33A"
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center justify-between w-full mb-10 p-3 md:p-4 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md rounded-2xl shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden min-w-0">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand-olive/10 dark:bg-brand-olive/20 flex items-center justify-center text-brand-olive shrink-0">
            <Map className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-[10px] md:text-xs uppercase tracking-widest font-bold text-stone-400 leading-none mb-1">
              Location
            </p>
            <p className="text-stone-800 dark:text-stone-200 font-semibold text-xs sm:text-sm md:text-base truncate">
              410 W 1st St #104, Tempe, AZ 85281
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-brand-olive text-white px-3 py-2 md:px-4 md:py-2 rounded-xl font-bold text-xs md:text-sm shadow-sm group-hover:bg-brand-olive/90 transition-colors shrink-0 ml-2">
          <span>Navigate</span>
          <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
        </div>
      </motion.a>

      {/* Owner Details */}
      <div className="flex flex-col items-center justify-center gap-5 md:gap-8 p-5 md:p-10 border-[3px] border-brand-orange/40 dark:border-brand-orange/20 rounded-3xl md:rounded-[2.5rem] bg-white/40 dark:bg-stone-900/40 backdrop-blur-sm w-full mx-auto shadow-lg hover:border-brand-orange/80 transition-colors">
        <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 text-stone-600 dark:text-stone-300 text-xs sm:text-sm md:text-lg uppercase tracking-[0.15em] sm:tracking-[0.2em] font-black flex-wrap">
          <span>John</span>
          <span className="text-brand-orange">|</span>
          <span>Charity</span>
          <span className="text-brand-orange">|</span>
          <span>Bru</span>
          <span>—</span>
          <span className="text-brand-orange">Owner</span>
        </div>
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex flex-wrap items-center gap-3 md:gap-6 w-full justify-center">
            <a
              href="tel:7605096910"
              className="flex items-center gap-2 sm:gap-3 px-6 py-3 md:px-10 md:py-5 rounded-full bg-white/70 dark:bg-stone-800/70 hover:bg-white dark:hover:bg-stone-800 border-2 border-stone-200/80 dark:border-stone-700/80 text-stone-600 hover:text-brand-orange hover:border-brand-orange/50 transition-all group shadow-sm hover:shadow-md"
            >
              <PhoneCall className="w-5 h-5 md:w-7 md:h-7 group-hover:animate-pulse" />
              <span className="text-sm md:text-xl font-bold">Call</span>
            </a>
            <a
              href="mailto:johngagne@bonesandbru.com"
              className="flex items-center gap-2 sm:gap-3 px-6 py-3 md:px-10 md:py-5 rounded-full bg-white/70 dark:bg-stone-800/70 hover:bg-white dark:hover:bg-stone-800 border-2 border-stone-200/80 dark:border-stone-700/80 text-stone-600 hover:text-brand-pink hover:border-brand-pink/50 transition-all group shadow-sm hover:shadow-md"
            >
              <Mailbox className="w-5 h-5 md:w-7 md:h-7 group-hover:animate-bounce" />
              <span className="text-sm md:text-xl font-bold">Email</span>
            </a>
          </div>
          <div className="flex justify-center w-full">
            <a
              href={`data:text/vcard;charset=utf-8,${encodeURIComponent(`BEGIN:VCARD\nVERSION:3.0\nFN:Bones & Bru\nORG:Bones & Bru\nTEL:7605096910\nEMAIL:johngagne@bonesandbru.com\nURL:https://bonesandbru.com\nADR:;;410 W 1st St #104;Tempe;AZ;85281;USA\nEND:VCARD`)}`}
              download="Bones_and_Bru.vcf"
              className="flex items-center gap-2 sm:gap-3 px-5 py-3 md:px-8 md:py-4 rounded-full bg-brand-pink/10 dark:bg-brand-pink/20 hover:bg-brand-pink text-brand-pink hover:text-white border-2 border-brand-pink/50 hover:border-brand-pink transition-all group shadow-sm hover:shadow-md"
            >
              <UserPlus className="w-5 h-5 md:w-6 md:h-6" />
              <span className="text-sm md:text-lg font-bold whitespace-nowrap">
                Save Shop Contact
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Google Reviews Card */}
      <div className="mt-8 flex flex-col items-center justify-center gap-4 p-5 md:p-10 border-[3px] border-brand-orange/40 dark:border-brand-orange/20 rounded-3xl md:rounded-[2.5rem] bg-white/40 dark:bg-stone-900/40 backdrop-blur-sm w-full mx-auto shadow-lg hover:border-brand-orange/80 transition-colors">
        <a
          href="https://g.page/r/CUGEACVcA-PbEAE/review"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 md:gap-5 px-6 py-3 md:px-10 md:py-5 rounded-full bg-white/70 dark:bg-stone-800/70 hover:bg-brand-orange hover:text-white border-2 border-brand-orange/50 hover:border-brand-orange shadow-sm hover:shadow-lg transition-all group"
        >
          <img
            src="/google-reviews.jpeg"
            alt="Google Reviews"
            className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shrink-0"
          />
          <div className="text-left">
            <p className="font-bold text-stone-800 dark:text-stone-200 group-hover:text-white text-sm sm:text-base md:text-xl transition-colors">
              Leave a Review
            </p>
            <p className="text-xs md:text-sm text-stone-500 dark:text-stone-400 group-hover:text-white/80 transition-colors">
              Support Small Business
            </p>
          </div>
        </a>
        <p className="text-stone-600 dark:text-stone-300 font-serif font-black text-sm md:text-base italic">
          "Tempe's top rated cafe!"
        </p>
      </div>

      {/* QR Code */}
      <div className="mt-10 flex justify-center w-full">
        <div className="p-4 bg-white dark:bg-stone-800 rounded-3xl shadow-xl border border-stone-200/50 dark:border-stone-700/50 hover:scale-105 transition-transform duration-300 flex flex-col items-center">
          <img
            src="/qr.jpeg"
            alt="Bones & Bru QR Code"
            className="w-48 h-48 md:w-56 md:h-56 rounded-2xl object-cover mb-3 shadow-inner"
            loading="lazy"
          />
          <span className="text-stone-500 dark:text-stone-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs">
            Scan to Share
          </span>
        </div>
      </div>
    </motion.footer>
  );
}
