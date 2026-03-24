import { motion } from "motion/react";
import { Instagram, Facebook } from "lucide-react";

const socialLinks = [
  {
    name: "Review",
    icon: <img src="/google-reviews.jpeg" alt="Google Reviews" className="w-full h-full object-cover" />,
    url: "https://share.google/ywUaCuyd8boFskL5d",
    color: "bg-brand-orange",
  },
  {
    name: "Instagram",
    icon: <Instagram className="w-8 h-8 md:w-10 md:h-10" />,
    url: "https://www.instagram.com/bonesandbru?igsh=NWY3Znc0OTZ4cmty",
    color: "bg-brand-pink",
  },
  {
    name: "Facebook",
    icon: <Facebook className="w-8 h-8 md:w-10 md:h-10" />,
    url: "https://www.facebook.com/share/14WviUCEUSy/",
    color: "bg-blue-600",
  },
  {
    name: "TikTok",
    icon: <img src="/tiktok logo.png" alt="TikTok" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover" />,
    url: "https://www.tiktok.com/@bonesandbru",
    color: "bg-black",
  },
];

export default function SocialGrid() {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4 md:gap-5 mb-12 md:mb-16 w-full">
      {socialLinks.map((social, index) => (
        <motion.a
          key={social.name}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + index * 0.1 }}
          whileHover={{ scale: 1.05, y: -4 }}
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center justify-center p-3 sm:p-5 md:p-6 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md rounded-2xl md:rounded-[2rem] shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover:shadow-lg transition-all group"
        >
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full ${social.color} text-white flex items-center justify-center mb-2 sm:mb-3 md:mb-4 shadow-md group-hover:scale-110 transition-transform duration-300 overflow-hidden`}
          >
            {social.icon}
          </div>
          <span className="text-[9px] sm:text-xs md:text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-widest text-center">
            {social.name}
          </span>
        </motion.a>
      ))}
    </div>
  );
}
