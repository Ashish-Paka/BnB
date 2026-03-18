/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Instagram, 
  Facebook, 
  MessageSquare, 
  Star,
  Heart,
  Moon,
  Sun,
  ExternalLink,
  Coffee,
  PawPrint,
  Bone,
  Dog,
  Map,
  PhoneCall,
  Mailbox,
  Play,
  UserPlus,
  X
} from "lucide-react";

import logo from "./assets/logo.webp";

const BACKGROUNDS = [
  { type: 'image', src: '/bg1.webp' },
  { type: 'image', src: '/bg2.webp' },
  { type: 'image', src: '/bru.webp' },
  { type: 'image', src: '/shop.webp' }
];

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });
  const [bgIndex, setBgIndex] = useState(0);
  const prevBgIndexRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    // Preload images to prevent glitching
    const preloadImages = async () => {
      const images = [logo, ...BACKGROUNDS.filter(b => b.type === 'image').map(b => b.src)];
      const promises = images.map((src) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      // Add a small artificial delay so the loader doesn't violently flicker on fast connections
      promises.push(new Promise(resolve => setTimeout(resolve, 800)));
      await Promise.all(promises);
      setIsLoaded(true);
    };
    preloadImages();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex((prev) => {
        prevBgIndexRef.current = prev;
        return (prev + 1) % BACKGROUNDS.length;
      });
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const socialLinks = [
    { name: "Review", icon: <Star className="w-5 h-5 md:w-6 md:h-6" />, url: "https://share.google/ywUaCuyd8boFskL5d", color: "bg-brand-orange" },
    { name: "Instagram", icon: <Instagram className="w-5 h-5 md:w-6 md:h-6" />, url: "https://www.instagram.com/bonesandbru?igsh=NWY3Znc0OTZ4cmty", color: "bg-brand-pink" },
    { name: "Facebook", icon: <Facebook className="w-5 h-5 md:w-6 md:h-6" />, url: "https://www.facebook.com/share/14WviUCEUSy/", color: "bg-blue-600" },
    { name: "TikTok", icon: <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />, url: "https://www.tiktok.com/@bonesandbru", color: "bg-black" },
  ];

  return (
    <>
      {/* Main Content (Always rendered to prevent DOM switching flickers on Android) */}
      <div className="min-h-screen flex flex-col items-center relative overflow-hidden bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] transition-colors duration-500">
          {/* Hero Header Section with Scrolling Background */}
          <div className="relative w-full h-[50dvh] min-h-[420px] max-h-[600px] flex items-center justify-center overflow-hidden rounded-b-[2.5rem] md:rounded-b-[4rem] shadow-xl">
            {/* Sliding Background - Only active + adjacent slides animate */}
            <div className="absolute inset-0 overflow-hidden bg-stone-900 border-b-0 flex items-center justify-center">
              {BACKGROUNDS.map((bg, idx) => {
                const isActive = idx === bgIndex;
                const isOutgoing = idx === prevBgIndexRef.current;
                const shouldAnimate = isActive || isOutgoing;

                let xPos: string;
                if (isActive) {
                  xPos = "0%";
                } else if (isOutgoing) {
                  xPos = "-100%";
                } else {
                  xPos = "100%";
                }

                return (
                  <motion.div
                    key={idx}
                    initial={false}
                    animate={{ x: xPos }}
                    transition={shouldAnimate ? { duration: 1.2, ease: "easeInOut" } : { duration: 0 }}
                    className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none [backface-visibility:hidden] [transform:translateZ(0)]"
                    style={{ willChange: "transform", WebkitBackfaceVisibility: "hidden", WebkitTransform: "translateZ(0)" }}
                  >
                    <img
                      src={bg.src}
                      className="absolute inset-0 w-full h-full object-contain"
                      alt={`Background ${idx + 1}`}
                      loading="eager"
                      decoding="async"
                    />
                  </motion.div>
                );
              })}
            </div>
        
        {/* Tint Overlay */}
        <div className="absolute inset-0 bg-stone-900/60 dark:bg-stone-900/80 z-10 pointer-events-none" />
        
        {/* Gradient fade to bottom */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--color-bg-light)] dark:from-[var(--color-bg-dark)] to-transparent z-10 pointer-events-none" />
      </div>

      {/* Logo Positioned Between Carousel and CTA */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        className="relative z-30 -mt-20 sm:-mt-24 md:-mt-32 mb-8 sm:mb-12"
      >
        <div className="bg-white dark:bg-stone-100 p-2 md:p-3 rounded-full shadow-2xl backdrop-blur-md border-[6px] border-white/50 dark:border-stone-800/50 flex items-center justify-center w-40 h-40 sm:w-48 sm:h-48 md:w-60 md:h-60 transition-all duration-300 mx-auto group hover:scale-105">
          <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-white p-1 sm:p-2 md:p-3 shadow-inner">
            <img 
              src={logo} 
              alt="Bones & Bru Logo" 
              className="w-full h-full object-contain scale-[1.05]" 
            />
          </div>
        </div>
      </motion.div>

      {/* Decorative Watercolor Background Elements - Isolated compositing */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-brand-orange/15 dark:bg-brand-orange/5 rounded-full blur-[100px] pointer-events-none" style={{ contain: "strict" }} />
      <div className="fixed top-[20%] right-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-brand-pink/15 dark:bg-brand-pink/5 rounded-full blur-[120px] pointer-events-none" style={{ contain: "strict" }} />
      <div className="fixed bottom-[-10%] left-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-brand-olive/15 dark:bg-brand-olive/5 rounded-full blur-[100px] pointer-events-none" style={{ contain: "strict" }} />

      {/* Fun Floating Dog Elements - Slower to reduce GPU contention */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
        className="fixed top-[10%] left-[5%] md:left-[10%] text-brand-orange/20 dark:text-brand-orange/10 pointer-events-none z-0"
      >
        <PawPrint className="w-16 h-16 md:w-32 md:h-32" />
      </motion.div>
      <motion.div
        animate={{ y: [0, 20, 0], rotate: [0, -15, 15, 0] }}
        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", delay: 1 }}
        className="fixed bottom-[15%] right-[5%] md:right-[10%] text-brand-pink/20 dark:text-brand-pink/10 pointer-events-none z-0"
      >
        <Bone className="w-16 h-16 md:w-28 md:h-28" />
      </motion.div>

      {/* Animated Dog Catching Ball - Simplified: single bounce, longer traverse */}
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

      {/* Theme Toggle */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="absolute top-4 right-4 md:top-8 md:right-8 p-3 md:p-4 rounded-full bg-white/80 dark:bg-stone-900/80 backdrop-blur-md shadow-sm border border-stone-200/50 dark:border-stone-700/50 z-50 text-stone-600 dark:text-stone-400 hover:shadow-md transition-all"
      >
        <AnimatePresence mode="wait">
          {isDarkMode ? (
            <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <Sun className="w-5 h-5 md:w-6 md:h-6" />
            </motion.div>
          ) : (
            <motion.div key="moon" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <Moon className="w-5 h-5 md:w-6 md:h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <main className="w-full max-w-2xl lg:max-w-3xl z-10 px-6 sm:px-8 pb-16 md:pb-24 flex flex-col items-center">
        {/* Highlighted CTA - Main Website & Navigate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="block w-full mb-10 md:mb-14 p-8 sm:p-10 md:p-14 rounded-[3rem] bg-gradient-to-br from-brand-orange via-brand-pink to-brand-orange bg-[length:200%_200%] animate-gradient text-white shadow-[0_20px_50px_-12px_rgba(236,72,153,0.4)] relative overflow-hidden group text-center border border-white/20 transition-all"
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
              <a href="https://bonesandbru.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-3 bg-white text-brand-orange px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-base md:text-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden bg-white flex items-center justify-center shrink-0">
                  <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                </div>
                <span>Order</span>
                <ExternalLink className="w-5 h-5 md:w-6 md:h-6 ml-1" />
              </a>
              
              <button 
                onClick={() => setShowVideoModal(true)} 
                className="inline-flex items-center justify-center gap-3 bg-brand-pink text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-base md:text-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 border-2 border-white/20"
              >
                <span>Walkthrough</span>
                <Play className="w-5 h-5 md:w-6 md:h-6 ml-1 fill-current" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Social Links Grid - Front and Centre */}
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
              <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full ${social.color} text-white flex items-center justify-center mb-2 sm:mb-3 md:mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                {social.icon}
              </div>
              <span className="text-[9px] sm:text-xs md:text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-widest text-center">
                {social.name}
              </span>
            </motion.a>
          ))}
        </div>

        {/* Footer / Thank You */}
        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center pb-8 md:pb-12"
        >
          <div className="h-px w-16 md:w-20 bg-stone-200 dark:bg-stone-800 mx-auto mb-6 md:mb-8" />
          <p className="font-serif italic text-stone-500 dark:text-stone-400 text-lg md:text-xl mb-8">
            "Thank you kindly for your support of small business."
          </p>
          
          {/* Address Bar / Navigate */}
          <motion.a
            href="https://maps.app.goo.gl/Ztxx4ZxxPG5SRg33A"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-between w-full max-w-md mx-auto mb-10 p-3 md:p-4 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md rounded-2xl shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand-olive/10 dark:bg-brand-olive/20 flex items-center justify-center text-brand-olive shrink-0">
                <Map className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="text-left truncate">
                <p className="text-[10px] md:text-xs uppercase tracking-widest font-bold text-stone-400 leading-none mb-1">
                  Location
                </p>
                <p className="text-stone-800 dark:text-stone-200 font-semibold text-sm md:text-base truncate">
                  410 W 1st St #104 Tempe, AZ
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-brand-olive text-white px-4 py-2 rounded-xl font-bold text-xs md:text-sm shadow-sm group-hover:bg-brand-olive/90 transition-colors shrink-0 ml-2">
              <span>Navigate</span>
              <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
            </div>
          </motion.a>

          {/* Owner Details & Small Contact Links */}
          <div className="flex flex-col items-center justify-center gap-6 md:gap-8 p-6 md:p-10 border-[3px] border-brand-orange/40 dark:border-brand-orange/20 rounded-[2.5rem] bg-white/40 dark:bg-stone-900/40 backdrop-blur-sm w-full max-w-lg mx-auto shadow-lg hover:border-brand-orange/80 transition-colors">
            <div className="flex items-center justify-center gap-4 md:gap-5 text-stone-600 dark:text-stone-300 text-sm md:text-lg uppercase tracking-[0.3em] font-black">
              <span>John Gagne</span>
              <span className="w-2 md:w-3 h-2 md:h-3 bg-brand-orange rounded-full" />
              <span>Owner</span>
            </div>
            
            <div className="flex flex-col items-center gap-4 w-full mt-2">
              <div className="flex flex-wrap items-center gap-4 md:gap-6 w-full justify-center">
                <a 
                  href="tel:7605096910" 
                  className="flex items-center gap-3 px-8 py-4 md:px-10 md:py-5 rounded-full bg-white/70 dark:bg-stone-800/70 hover:bg-white dark:hover:bg-stone-800 border-2 border-stone-200/80 dark:border-stone-700/80 text-stone-600 hover:text-brand-orange hover:border-brand-orange/50 transition-all group shadow-sm hover:shadow-md"
                >
                  <PhoneCall className="w-6 h-6 md:w-7 md:h-7 group-hover:animate-pulse" />
                  <span className="text-base md:text-xl font-bold">Call</span>
                </a>
                <a 
                  href="mailto:johngagne@bonesandbru.com" 
                  className="flex items-center gap-3 px-8 py-4 md:px-10 md:py-5 rounded-full bg-white/70 dark:bg-stone-800/70 hover:bg-white dark:hover:bg-stone-800 border-2 border-stone-200/80 dark:border-stone-700/80 text-stone-600 hover:text-brand-pink hover:border-brand-pink/50 transition-all group shadow-sm hover:shadow-md"
                >
                  <Mailbox className="w-6 h-6 md:w-7 md:h-7 group-hover:animate-bounce" />
                  <span className="text-base md:text-xl font-bold">Email</span>
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-4 md:gap-6 w-full justify-center">
                <a 
                  href={`data:text/vcard;charset=utf-8,${encodeURIComponent(`BEGIN:VCARD\nVERSION:3.0\nFN:John Gagne\nORG:Bones & Bru\nTEL:7605096910\nEMAIL:johngagne@bonesandbru.com\nEND:VCARD`)}`}
                  download="John_Gagne.vcf"
                  className="flex items-center gap-3 px-6 py-3 md:px-8 md:py-4 rounded-full bg-brand-orange/10 dark:bg-brand-orange/20 hover:bg-brand-orange text-brand-orange hover:text-white border-2 border-brand-orange/50 hover:border-brand-orange transition-all group shadow-sm hover:shadow-md"
                >
                  <UserPlus className="w-5 h-5 md:w-6 md:h-6" />
                  <span className="text-sm md:text-lg font-bold whitespace-nowrap">Save John</span>
                </a>
                <a 
                  href={`data:text/vcard;charset=utf-8,${encodeURIComponent(`BEGIN:VCARD\nVERSION:3.0\nFN:Bones & Bru\nORG:Bones & Bru\nTEL:7605096910\nEMAIL:johngagne@bonesandbru.com\nURL:https://bonesandbru.com\nADR:;;410 W 1st St #104;Tempe;AZ;85281;USA\nEND:VCARD`)}`}
                  download="Bones_and_Bru.vcf"
                  className="flex items-center gap-3 px-6 py-3 md:px-8 md:py-4 rounded-full bg-brand-pink/10 dark:bg-brand-pink/20 hover:bg-brand-pink text-brand-pink hover:text-white border-2 border-brand-pink/50 hover:border-brand-pink transition-all group shadow-sm hover:shadow-md"
                >
                  <UserPlus className="w-5 h-5 md:w-6 md:h-6" />
                  <span className="text-sm md:text-lg font-bold whitespace-nowrap">Save Shop</span>
                </a>
              </div>
            </div>
          </div>
        </motion.footer>
      </main>

      {/* Video Modal Overlay */}
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
                src="/video.mp4"
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>

      {/* Fullscreen Loader Overlay (Fades out when load completes) */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-stone-100 dark:bg-stone-900 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-brand-orange/20 flex items-center justify-center p-3"
            >
              <img src={logo} alt="Loading..." className="w-full h-full object-contain opacity-50" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
