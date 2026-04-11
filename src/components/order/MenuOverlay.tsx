import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Minus, ShoppingBag, User, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchPublicMenu, createOrder, getMenuImageUrl, fetchPublicMenuOrdering } from "../../lib/api";
import { useCart } from "../../contexts/CartContext";
import type { MenuItem, MenuOrdering } from "../../lib/types";
import { deriveCategories, deriveCategoryLayout, categoryLabel } from "../../lib/constants";

interface Props {
  open: boolean;
  onClose: () => void;
  onOrderPlaced?: (orderId: string) => void;
  customerId?: string | null;
  orderingEnabled: boolean;
}

export default function MenuOverlay({ open, onClose, onOrderPlaced, customerId, orderingEnabled }: Props) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [ordering, setOrdering] = useState<MenuOrdering>({ category_order: [], subcategory_order: {} });
  const cart = useCart();
  const categories = useMemo(() => deriveCategories(menu, ordering.category_order), [menu, ordering]);
  const orderingRef = useRef(ordering);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkCatScroll = useCallback(() => {
    const el = catScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = catScrollRef.current;
    if (!el) return;
    checkCatScroll();
    el.addEventListener("scroll", checkCatScroll, { passive: true });
    const ro = new ResizeObserver(checkCatScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkCatScroll); ro.disconnect(); };
  }, [categories, checkCatScroll]);

  const scrollCats = (dir: "left" | "right") => {
    const el = catScrollRef.current;
    if (!el) return;
    if (dir === "right" && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else if (dir === "left" && el.scrollLeft <= 0) {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    } else {
      el.scrollBy({ left: dir === "left" ? -150 : 150, behavior: "smooth" });
    }
  };

  useEffect(() => {
    orderingRef.current = ordering;
  }, [ordering]);

  const syncMenuState = useCallback((nextMenu: MenuItem[], nextOrdering: MenuOrdering) => {
    setMenu(nextMenu);
    setOrdering(nextOrdering);
    const cats = deriveCategories(nextMenu, nextOrdering.category_order);
    setActiveCategory((current) => {
      if (cats.length === 0) return "";
      if (!current || !cats.includes(current)) return cats[0];
      return current;
    });
  }, []);

  const refreshMenuState = useCallback(() => {
    return Promise.all([
      fetchPublicMenu(),
      fetchPublicMenuOrdering().catch(() => orderingRef.current),
    ])
      .then(([data, ord]) => {
        syncMenuState(data, ord);
      })
      .catch(() => {});
  }, [syncMenuState]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetchPublicMenu(),
      fetchPublicMenuOrdering().catch(() => ({ category_order: [], subcategory_order: {} })),
    ])
      .then(([data, ord]) => {
        syncMenuState(data, ord);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void refreshMenuState();
      }
    };
    const id = setInterval(() => {
      void refreshMenuState();
    }, 3_000);
    window.addEventListener("focus", refreshMenuState);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refreshMenuState);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [open, refreshMenuState, syncMenuState]);

  // Items for the active category, sorted by sort_order, grouped by subcategory
  const categoryItems = useMemo(() => {
    const items = menu
      .filter((item) => item.category === activeCategory)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return items;
  }, [menu, activeCategory]);

  const layoutEntries = useMemo(() => {
    return deriveCategoryLayout(categoryItems, activeCategory, ordering.subcategory_order[activeCategory]);
  }, [categoryItems, activeCategory, ordering]);

  // Always open modal so users can see full description + image
  const handleSelectItem = (item: MenuItem) => {
    const defaults: Record<string, string[]> = {};
    if (item.options) {
      for (const opt of item.options) {
        const maxSel = opt.max_selections ?? 1;
        if (maxSel <= 1 && opt.choices.length > 0) {
          // Single-select: default to first choice
          defaults[opt.name] = opt.choices[0]?.label ? [opt.choices[0].label] : [];
        } else {
          // Multi-select: default to empty
          defaults[opt.name] = [];
        }
      }
    }
    setSelectedOptions(defaults);
    setSelectedItem(item);
  };

  const isOptionValid = () => {
    if (!selectedItem?.options) return true;
    return selectedItem.options.every((opt) => {
      const minSel = opt.min_selections ?? 1;
      const selected = selectedOptions[opt.name] || [];
      return selected.length >= minSel;
    });
  };

  const handleAddWithOptions = () => {
    if (selectedItem && isOptionValid()) {
      cart.addItem(selectedItem, selectedOptions);
      setSelectedItem(null);
      setSelectedOptions({});
    }
  };

  const toggleOption = (optName: string, choiceLabel: string, maxSel: number) => {
    setSelectedOptions((prev) => {
      const current = prev[optName] || [];
      if (maxSel <= 1) {
        // Single-select: radio behavior (toggle off if clicking same, else replace)
        return { ...prev, [optName]: current.includes(choiceLabel) ? [] : [choiceLabel] };
      }
      // Multi-select: toggle in/out
      if (current.includes(choiceLabel)) {
        return { ...prev, [optName]: current.filter((l) => l !== choiceLabel) };
      }
      if (current.length >= maxSel) return prev; // at max
      return { ...prev, [optName]: [...current, choiceLabel] };
    });
  };

  const handlePlaceOrder = async () => {
    if (!customerName.trim() || !orderingEnabled) return;
    setPlacing(true);
    try {
      const order = await createOrder({
        customer_id: customerId || null,
        customer_name: customerName.trim(),
        items: cart.items.map((ci) => ({
          menu_item_id: ci.menu_item.id,
          item_name: ci.menu_item.name,
          quantity: ci.quantity,
          price_cents: ci.total_cents,
          options: ci.selected_options,
        })),
        total_cents: cart.totalCents,
        created_by: "customer",
      });
      cart.clearCart();
      setOrderPlaced(true);
      setCustomerName("");
      onOrderPlaced?.(order.id);
    } catch {
      // Error handling
    } finally {
      setPlacing(false);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

  const calculateSelectedTotal = () => {
    if (!selectedItem) return 0;
    let total = selectedItem.base_price_cents;
    if (selectedItem.options) {
      for (const opt of selectedItem.options) {
        const selected = selectedOptions[opt.name] || [];
        for (const label of selected) {
          const choice = opt.choices.find((c) => c.label === label);
          if (choice) total += choice.extra_cents;
        }
      }
    }
    return total;
  };

  // Build option summary string with costs for card display
  const optionSummary = (item: MenuItem) => {
    if (!item.options || item.options.length === 0) return null;
    return item.options.map((opt) => {
      const extras = opt.choices.filter((c) => c.extra_cents > 0);
      if (extras.length > 0) {
        const maxExtra = Math.max(...extras.map((c) => c.extra_cents));
        return `${opt.name} (+${formatPrice(maxExtra)})`;
      }
      return opt.name;
    }).join(" · ");
  };

  const renderItemCard = (item: MenuItem) => (
    <motion.div
      key={item.id}
      whileTap={{ scale: 0.98 }}
      onClick={() => handleSelectItem(item)}
      className="w-full text-left p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-sm transition-all cursor-pointer hover:shadow-md flex flex-col gap-2"
    >
      {/* Top row: image + name */}
      <div className="flex items-center gap-3">
        {item.has_image && (
          <img
            src={getMenuImageUrl(item.id)}
            alt=""
            className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover shrink-0"
            loading="lazy"
          />
        )}
        <h4 className="font-bold text-stone-800 dark:text-stone-200 text-base">
          {item.name}
        </h4>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
          {item.description}
        </p>
      )}

      {/* Options with costs */}
      {optionSummary(item) && (
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {optionSummary(item)}
        </p>
      )}

      {/* Bottom row: price right, plus button */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <span className="font-bold text-brand-olive text-lg">
          {formatPrice(item.base_price_cents)}
        </span>
        <div className="w-8 h-8 rounded-full bg-brand-olive/10 flex items-center justify-center text-brand-olive">
          <Plus className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[var(--bg-color)] overflow-y-auto overscroll-y-contain"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-color-95)] backdrop-blur-md border-b border-stone-300 dark:border-stone-700 px-4 py-3 flex items-center justify-between will-change-transform">
        <h2 className="font-serif text-2xl font-black text-stone-800 dark:text-stone-200">
          Menu
        </h2>
        <div className="flex items-center gap-3">
          {cart.itemCount > 0 && (
            <button
              onClick={() => { setShowCheckout(true); setOrderPlaced(false); }}
              className="relative flex items-center gap-2 bg-brand-olive text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{formatPrice(cart.totalCents)}</span>
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-brand-olive rounded-full text-xs font-black flex items-center justify-center">
                {cart.itemCount}
              </span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-[53px] z-[9] bg-[var(--bg-color-95)] backdrop-blur-md border-b border-stone-300 dark:border-stone-700 will-change-transform">
        <div
          ref={catScrollRef}
          className="px-4 py-3 flex gap-2 overflow-x-auto overscroll-x-contain scrollbar-hide"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? "bg-brand-olive text-white shadow-md"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shadow-xs"
              }`}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex justify-center pb-2">
            <div className="inline-flex items-center bg-brand-olive/10 rounded-full px-2 py-0.5 gap-1">
              <button onClick={() => scrollCats("left")} className="text-brand-olive disabled:opacity-30" disabled={!canScrollLeft}>
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-[9px] font-bold text-brand-olive uppercase tracking-wider">scroll</span>
              <button onClick={() => scrollCats("right")} className="text-brand-olive disabled:opacity-30" disabled={!canScrollRight}>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Menu items in the saved mixed layout */}
      <div className="px-4 pb-32">
        {loading ? (
          <div className="text-center py-12 text-stone-400">Loading menu...</div>
        ) : (
          <div className="mt-3 space-y-5">
            {layoutEntries.map((entry) => (
              <div key={entry.id}>
                {entry.kind === "item" ? (
                  renderItemCard(entry.item)
                ) : (
                  <>
                {/* Subcategory header */}
                {entry.subcategory && (
                  <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2.5 px-1">
                    {categoryLabel(entry.subcategory)}
                  </h3>
                )}
                {/* Items — indent subcategory items with a subtle left accent */}
                {entry.subcategory ? (
                  <div className="ml-2 pl-3 border-l-2 border-brand-olive/20 dark:border-brand-olive/15">
                    <div className="grid gap-3">
                      {entry.items.map((item) => renderItemCard(item))}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {entry.items.map((item) => renderItemCard(item))}
                  </div>
                )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Item detail / Options modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-[var(--bg-color)] rounded-t-3xl p-6 shadow-2xl max-h-[85dvh] overflow-y-auto overscroll-y-contain"
            >
              {/* Item image in modal */}
              {selectedItem.has_image && (
                <img
                  src={getMenuImageUrl(selectedItem.id)}
                  alt={selectedItem.name}
                  className="w-full rounded-2xl object-contain mb-4"
                />
              )}

              <h3 className="font-serif text-xl font-black text-stone-800 dark:text-stone-200 mb-1">
                {selectedItem.name}
              </h3>

              {/* Full description */}
              {selectedItem.description && (
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 leading-relaxed">
                  {selectedItem.description}
                </p>
              )}

              {selectedItem.options?.map((opt) => {
                const minSel = opt.min_selections ?? 1;
                const maxSel = opt.max_selections ?? 1;
                const selected = selectedOptions[opt.name] || [];
                const atMax = maxSel > 1 && selected.length >= maxSel;
                return (
                  <div key={opt.name} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                        {opt.name}
                      </label>
                      {opt.show_requirement_label && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400">
                          {minSel === 0 && maxSel >= opt.choices.length
                            ? "Optional"
                            : minSel === maxSel
                              ? `Pick ${minSel}`
                              : minSel === 0
                                ? `Up to ${maxSel}`
                                : `Pick ${minSel}-${maxSel}`}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {opt.choices.map((choice) => {
                        const isSelected = selected.includes(choice.label);
                        const isDisabled = !isSelected && atMax;
                        return (
                          <button
                            key={choice.label}
                            onClick={() => toggleOption(opt.name, choice.label, maxSel)}
                            disabled={isDisabled}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                              isSelected
                                ? "bg-brand-olive text-white shadow-md"
                                : isDisabled
                                  ? "bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600 border border-stone-200 dark:border-stone-700 opacity-50 cursor-not-allowed"
                                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shadow-xs"
                            }`}
                          >
                            {choice.label}
                            {choice.extra_cents > 0 && (
                              <span className="ml-1 opacity-70">
                                +{formatPrice(choice.extra_cents)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {minSel > 0 && selected.length < minSel && (
                      <p className="text-xs text-red-400 mt-1">Select at least {minSel}</p>
                    )}
                  </div>
                );
              })}
              <button
                onClick={handleAddWithOptions}
                disabled={!isOptionValid()}
                className="w-full py-3 rounded-xl bg-brand-olive text-white font-bold text-lg shadow-lg mt-2 disabled:opacity-50"
              >
                Add to Order · {formatPrice(calculateSelectedTotal())}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout sheet */}
      <AnimatePresence>
        {showCheckout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowCheckout(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-[var(--bg-color)] rounded-t-3xl p-6 shadow-2xl max-h-[80dvh] overflow-y-auto overscroll-y-contain"
            >
              {orderPlaced ? (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-5xl mb-3"
                  >
                    ✅
                  </motion.div>
                  <h3 className="font-serif text-2xl font-black text-stone-800 dark:text-stone-200 mb-2">
                    Order Placed!
                  </h3>
                  <p className="text-stone-500 dark:text-stone-400 text-sm mb-6">
                    Pay at the counter. Track your order on the green banner.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => {
                        setShowCheckout(false);
                        setOrderPlaced(false);
                      }}
                      className="px-5 py-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-sm border border-stone-200 dark:border-stone-700 shadow-xs"
                    >
                      Order More
                    </button>
                    <button
                      onClick={() => {
                        setShowCheckout(false);
                        setOrderPlaced(false);
                        onClose();
                      }}
                      className="px-5 py-3 rounded-xl bg-brand-olive text-white font-bold text-sm"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="font-serif text-xl font-black text-stone-800 dark:text-stone-200 mb-4">
                    Your Order
                  </h3>

                  {/* Cart items */}
                  <div className="flex flex-col gap-3 mb-4">
                    {cart.items.map((ci, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-300 dark:border-stone-700"
                      >
                        <div className="flex-1">
                          <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                            {ci.menu_item.name}
                          </p>
                          {Object.values(ci.selected_options).some((v) => Array.isArray(v) ? v.length > 0 : !!v) && (
                            <p className="text-xs text-stone-400">
                              {Object.values(ci.selected_options)
                                .map((v) => (Array.isArray(v) ? v.join(", ") : v))
                                .filter(Boolean)
                                .join("; ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => cart.updateQuantity(idx, ci.quantity - 1)}
                              className="w-7 h-7 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold text-stone-800 dark:text-stone-200">
                              {ci.quantity}
                            </span>
                            <button
                              onClick={() => cart.updateQuantity(idx, ci.quantity + 1)}
                              className="w-7 h-7 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="font-bold text-sm text-stone-800 dark:text-stone-200 w-12 text-right">
                            {formatPrice(ci.total_cents * ci.quantity)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center py-3 border-t border-stone-200 dark:border-stone-700 mb-4">
                    <span className="font-bold text-stone-600 dark:text-stone-400">
                      Total
                    </span>
                    <span className="font-black text-xl text-stone-800 dark:text-stone-200">
                      {formatPrice(cart.totalCents)}
                    </span>
                  </div>

                  {/* Name input */}
                  <div className="mb-4">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 block">
                      Name for your order
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Your name"
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-brand-olive focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  {!orderingEnabled && (
                    <p className="text-sm text-red-500 dark:text-red-400 text-center mb-3 font-medium">
                      In-store ordering is currently disabled
                    </p>
                  )}

                  <p className="text-xs text-stone-400 mb-4 text-center">
                    Payment will be collected at the counter
                  </p>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={placing || !customerName.trim() || cart.itemCount === 0 || !orderingEnabled}
                    className="w-full py-3 rounded-xl bg-brand-olive text-white font-bold text-lg shadow-lg disabled:opacity-50"
                  >
                    {placing ? "Placing Order..." : !orderingEnabled ? "Ordering Disabled" : "Place Order"}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
