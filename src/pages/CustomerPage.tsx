import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import logo from "../assets/logo.webp";

import HeroSection from "../components/landing/HeroSection";
import FloatingDecorations from "../components/landing/FloatingDecorations";
import ThemeToggle from "../components/landing/ThemeToggle";
import CTABanner from "../components/landing/CTABanner";
import SocialGrid from "../components/landing/SocialGrid";
import WalkthroughButton from "../components/landing/WalkthroughButton";
import Footer from "../components/landing/Footer";
import RewardsBanner from "../components/rewards/RewardsBanner";
import InCafeBanner from "../components/order/InCafeBanner";
import MenuOverlay from "../components/order/MenuOverlay";
import { useCart } from "../contexts/CartContext";
import { fetchOrderStatus, checkRewards } from "../lib/api";

function getStoredCustomerId(): string | null {
  try {
    const saved = localStorage.getItem("bnb_customer");
    if (saved) {
      const c = JSON.parse(saved);
      return c?.id || null;
    }
  } catch {}
  return null;
}

export default function CustomerPage() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [pendingOtp, setPendingOtp] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("otp");
  });
  const [rewardsRefresh, setRewardsRefresh] = useState(0);
  const cart = useCart();

  // Order tracking state
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() =>
    sessionStorage.getItem("bnb_active_order")
  );
  const [activeOrderStatus, setActiveOrderStatus] = useState<string | null>(null);
  const orderPollRef = useRef<ReturnType<typeof setInterval>>(null);

  // Poll active order status
  useEffect(() => {
    if (!activeOrderId) {
      setActiveOrderStatus(null);
      return;
    }
    // Initial fetch
    fetchOrderStatus(activeOrderId)
      .then((r) => setActiveOrderStatus(r.status))
      .catch(() => {});

    orderPollRef.current = setInterval(async () => {
      try {
        const res = await fetchOrderStatus(activeOrderId);
        setActiveOrderStatus(res.status);
        if (res.status === "completed") {
          if (orderPollRef.current) clearInterval(orderPollRef.current);
          // Refresh customer rewards data if logged in
          refreshCustomerData();
          // Auto-clear after 10 seconds
          setTimeout(() => {
            setActiveOrderId(null);
            setActiveOrderStatus(null);
            sessionStorage.removeItem("bnb_active_order");
          }, 10000);
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      if (orderPollRef.current) clearInterval(orderPollRef.current);
    };
  }, [activeOrderId]);

  const refreshCustomerData = async () => {
    try {
      const saved = localStorage.getItem("bnb_customer");
      if (!saved) return;
      const customer = JSON.parse(saved);
      // Re-fetch using whatever identifier we have
      const identifier: { phone?: string; email?: string; name?: string } = {};
      if (customer.phone) identifier.phone = customer.phone;
      else if (customer.email) identifier.email = customer.email;
      if (customer.names?.[0]) identifier.name = customer.names[0];
      if (!identifier.phone && !identifier.email) return;
      const res = await checkRewards(identifier);
      if (res.customer) {
        localStorage.setItem("bnb_customer", JSON.stringify(res.customer));
        setRewardsRefresh((n) => n + 1);
      }
    } catch {}
  };

  const handleOrderPlaced = (orderId: string) => {
    setActiveOrderId(orderId);
    setActiveOrderStatus("pending");
    sessionStorage.setItem("bnb_active_order", orderId);
  };

  useEffect(() => {
    const preloadImages = async () => {
      const images = [
        logo,
        "/bg1.webp",
        "/bg2.webp",
        "/bru.webp",
        "/shop.webp",
      ];
      const promises = images.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = resolve;
            img.onerror = resolve;
          })
      );
      promises.push(new Promise((resolve) => setTimeout(resolve, 800)));
      await Promise.all(promises);
      setIsLoaded(true);
    };
    preloadImages();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  return (
    <>
      <div className="min-h-screen flex flex-col items-center relative overflow-hidden bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] transition-colors duration-500">
        <HeroSection />
        <FloatingDecorations />
        <ThemeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

        <main className="w-full max-w-2xl lg:max-w-3xl z-10 px-6 sm:px-8 pb-16 md:pb-24 flex flex-col items-center">
          {/* Order Online (existing CTA) */}
          <CTABanner />

          {/* Order In-Cafe */}
          <InCafeBanner
            onOpen={() => setShowMenu(true)}
            itemCount={cart.itemCount}
            orderStatus={activeOrderStatus}
          />

          {/* Rewards */}
          <RewardsBanner
            pendingOtpCode={pendingOtp}
            onOtpProcessed={() => {
              setPendingOtp(null);
              history.replaceState({}, "", "/");
            }}
            refreshTrigger={rewardsRefresh}
          />

          {/* Social Links */}
          <SocialGrid />

          {/* Virtual Walkthrough */}
          <WalkthroughButton />

          {/* Footer */}
          <Footer />
        </main>
      </div>

      {/* Menu Overlay */}
      <AnimatePresence>
        {showMenu && (
          <MenuOverlay
            open={showMenu}
            onClose={() => setShowMenu(false)}
            onOrderPlaced={handleOrderPlaced}
            customerId={getStoredCustomerId()}
          />
        )}
      </AnimatePresence>

      {/* Loader */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-stone-100 dark:bg-stone-900 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-brand-orange/20 flex items-center justify-center p-3"
            >
              <img
                src={logo}
                alt="Loading..."
                className="w-full h-full object-contain opacity-50"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
