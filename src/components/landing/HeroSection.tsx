import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import defaultLogo from "../../assets/logo.webp";
import { getCarouselImageUrl, getLogoImageUrl } from "../../lib/api";

const DEFAULT_BACKGROUNDS = [
  "/bg1.webp",
  "/coffeebar.jpeg",
  "/bru.webp",
  "/dogtreats.jpeg",
  "/shop.webp",
];

interface Props {
  images?: string[];
  hasCustomLogo?: boolean;
}

function resolveImageSrc(src: string) {
  return src.startsWith("carousel:") ? getCarouselImageUrl(src.slice(9)) : src;
}

export default function HeroSection({ images, hasCustomLogo }: Props) {
  const backgrounds = (images && images.length > 0 ? images : DEFAULT_BACKGROUNDS).map(resolveImageSrc);
  const [bgIndex, setBgIndex] = useState(0);
  const prevBgIndexRef = useRef(0);
  const logoSrc = hasCustomLogo ? `${getLogoImageUrl()}?t=1` : defaultLogo;

  useEffect(() => {
    if (backgrounds.length <= 1) return;
    const timer = setInterval(() => {
      setBgIndex((prev) => {
        prevBgIndexRef.current = prev;
        return (prev + 1) % backgrounds.length;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [backgrounds.length]);

  return (
    <>
      {/* Hero Header Section with Scrolling Background */}
      <div className="relative z-[1] w-full h-[50dvh] min-h-[420px] max-h-[600px] flex items-center justify-center overflow-hidden rounded-b-[2.5rem] md:rounded-b-[4rem] shadow-xl">
        <div className="absolute inset-0 overflow-hidden bg-stone-900 border-b-0 flex items-center justify-center">
          {backgrounds.map((src, idx) => {
            const isActive = idx === bgIndex;
            const isOutgoing = idx === prevBgIndexRef.current;
            const shouldAnimate = isActive || isOutgoing;
            let xPos: string;
            if (isActive) xPos = "0%";
            else if (isOutgoing) xPos = "-100%";
            else xPos = "100%";

            return (
              <motion.div
                key={idx}
                initial={false}
                animate={{ x: xPos }}
                transition={
                  shouldAnimate
                    ? { duration: 1.2, ease: "easeInOut" }
                    : { duration: 0 }
                }
                className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none [backface-visibility:hidden] [transform:translateZ(0)]"
                style={{
                  willChange: "transform",
                  WebkitBackfaceVisibility: "hidden",
                  WebkitTransform: "translateZ(0)",
                }}
              >
                <img
                  src={src}
                  className="absolute inset-0 w-full h-full object-contain"
                  alt={`Background ${idx + 1}`}
                  loading="eager"
                  decoding="async"
                />
              </motion.div>
            );
          })}
        </div>
        <div className="absolute inset-0 bg-stone-900/40 dark:bg-stone-900/40 z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--bg-color)] to-transparent z-10 pointer-events-none" />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        className="relative z-[5] -mt-24 sm:-mt-28 md:-mt-36 mb-8 sm:mb-12"
      >
        <div className="rounded-full shadow-2xl flex items-center justify-center w-52 h-52 sm:w-60 sm:h-60 md:w-72 md:h-72 transition-all duration-300 mx-auto group hover:scale-105 overflow-hidden">
          <img
            src={logoSrc}
            alt="Bones & Bru Logo"
            className="w-full h-full object-cover"
          />
        </div>
      </motion.div>
    </>
  );
}
