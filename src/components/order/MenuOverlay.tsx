import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Minus, ShoppingBag, User } from "lucide-react";
import { fetchMenu, createOrder, getMenuImageUrl } from "../../lib/api";
import { useCart } from "../../contexts/CartContext";
import type { MenuItem } from "../../lib/types";
import { deriveCategories, categoryLabel } from "../../lib/constants";

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
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const cart = useCart();
  const categories = useMemo(() => deriveCategories(menu), [menu]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchMenu()
        .then((data) => {
          setMenu(data);
          const cats = deriveCategories(data);
          if (cats.length > 0 && !cats.includes(activeCategory)) {
            setActiveCategory(cats[0]);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  const filteredMenu = menu.filter((item) => item.category === activeCategory);

  const handleSelectItem = (item: MenuItem) => {
    if (!item.options || item.options.length === 0) {
      // No options, add directly
      cart.addItem(item, {});
      return;
    }
    // Set defaults for each option
    const defaults: Record<string, string> = {};
    for (const opt of item.options) {
      defaults[opt.name] = opt.choices[0]?.label || "";
    }
    setSelectedOptions(defaults);
    setSelectedItem(item);
  };

  const handleAddWithOptions = () => {
    if (selectedItem) {
      cart.addItem(selectedItem, selectedOptions);
      setSelectedItem(null);
      setSelectedOptions({});
    }
  };

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) return;
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
        const selected = selectedOptions[opt.name];
        const choice = opt.choices.find((c) => c.label === selected);
        if (choice) total += choice.extra_cents;
      }
    }
    return total;
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg-light)]/95 dark:bg-[var(--color-bg-dark)]/95 backdrop-blur-md border-b border-stone-200/50 dark:border-stone-700/50 px-4 py-3 flex items-center justify-between">
        <h2 className="font-serif text-2xl font-black text-stone-800 dark:text-stone-200">
          Menu
        </h2>
        <div className="flex items-center gap-3">
          {orderingEnabled && cart.itemCount > 0 && (
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
      <div className="px-4 py-3 flex gap-2 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "bg-brand-olive text-white shadow-md"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
            }`}
          >
            {categoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Menu items */}
      <div className="px-4 pb-32">
        {loading ? (
          <div className="text-center py-12 text-stone-400">Loading menu...</div>
        ) : (
          <div className="grid gap-3 mt-2">
            {filteredMenu.map((item) => (
              <motion.div
                key={item.id}
                whileTap={orderingEnabled ? { scale: 0.98 } : undefined}
                onClick={orderingEnabled ? () => handleSelectItem(item) : undefined}
                className={`w-full text-left p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/50 dark:border-stone-700/50 shadow-sm transition-all flex items-center justify-between gap-4 ${orderingEnabled ? "cursor-pointer hover:shadow-md" : ""}`}
              >
                {item.has_image && (
                  <img
                    src={getMenuImageUrl(item.id)}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-stone-800 dark:text-stone-200">
                    {item.name}
                  </h4>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {item.description}
                  </p>
                  {item.options && item.options.length > 0 && (
                    <p className="text-xs text-stone-400 mt-1">
                      {item.options.map((o) => o.name).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-brand-olive text-lg">
                    {formatPrice(item.base_price_cents)}
                  </span>
                  {orderingEnabled && (
                    <div className="w-8 h-8 rounded-full bg-brand-olive/10 flex items-center justify-center text-brand-olive">
                      <Plus className="w-5 h-5" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Options modal */}
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
              className="w-full sm:max-w-lg bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] rounded-t-3xl p-6 shadow-2xl"
            >
              <h3 className="font-serif text-xl font-black text-stone-800 dark:text-stone-200 mb-4">
                {selectedItem.name}
              </h3>
              {selectedItem.options?.map((opt) => (
                <div key={opt.name} className="mb-4">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 block">
                    {opt.name}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {opt.choices.map((choice) => (
                      <button
                        key={choice.label}
                        onClick={() =>
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [opt.name]: choice.label,
                          }))
                        }
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                          selectedOptions[opt.name] === choice.label
                            ? "bg-brand-olive text-white shadow-md"
                            : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                        }`}
                      >
                        {choice.label}
                        {choice.extra_cents > 0 && (
                          <span className="ml-1 opacity-70">
                            +{formatPrice(choice.extra_cents)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddWithOptions}
                className="w-full py-3 rounded-xl bg-brand-olive text-white font-bold text-lg shadow-lg mt-2"
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
              className="w-full sm:max-w-lg bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] rounded-t-3xl p-6 shadow-2xl max-h-[80dvh] overflow-y-auto"
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
                      className="px-5 py-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-sm"
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
                        className="flex items-center justify-between p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200/50 dark:border-stone-700/50"
                      >
                        <div className="flex-1">
                          <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                            {ci.menu_item.name}
                          </p>
                          {Object.entries(ci.selected_options).length > 0 && (
                            <p className="text-xs text-stone-400">
                              {Object.values(ci.selected_options).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => cart.updateQuantity(idx, ci.quantity - 1)}
                              className="w-7 h-7 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold text-stone-800 dark:text-stone-200">
                              {ci.quantity}
                            </span>
                            <button
                              onClick={() => cart.updateQuantity(idx, ci.quantity + 1)}
                              className="w-7 h-7 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center"
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

                  <p className="text-xs text-stone-400 mb-4 text-center">
                    Payment will be collected at the counter
                  </p>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={placing || !customerName.trim() || cart.itemCount === 0}
                    className="w-full py-3 rounded-xl bg-brand-olive text-white font-bold text-lg shadow-lg disabled:opacity-50"
                  >
                    {placing ? "Placing Order..." : "Place Order"}
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
