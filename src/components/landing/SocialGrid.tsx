import { motion } from "motion/react";
import { Instagram, Facebook } from "lucide-react";

const GoogleGIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8 md:w-10 md:h-10">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const socialLinks = [
  {
    name: "Reviews",
    icon: <GoogleGIcon />,
    url: "https://share.google/ywUaCuyd8boFskL5d",
    color: "bg-white border-2 border-stone-200 dark:border-stone-600",
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
          className="flex flex-col items-center justify-center p-3 sm:p-5 md:p-6 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md rounded-2xl md:rounded-[2rem] shadow-sm border border-stone-300 dark:border-stone-700 hover:shadow-lg transition-all group"
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
