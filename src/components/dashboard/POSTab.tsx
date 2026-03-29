import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, Plus, Minus, X, Gift, UserPlus, User } from "lucide-react";
import { fetchMenu, fetchCustomers, createOrder, checkRewards, getMenuImageUrl } from "../../lib/api";
import type { MenuItem, Customer, OrderItem } from "../../lib/types";
import { deriveCategories, categoryLabel, REWARD_THRESHOLD } from "../../lib/constants";
import Modal from "../ui/Modal";

interface POSCartItem {
  menuItem: MenuItem;
  options: Record<string, string>;
  quantity: number;
  unitCents: number;
}

interface Props {
  onOrderCreated: () => void;
  addToast: (msg: string, type: "success" | "error") => void;
}

export default function POSTab({ onOrderCreated, addToast }: Props) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [freeReward, setFreeReward] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const categories = useMemo(() => deriveCategories(menu), [menu]);

  useEffect(() => {
    fetchMenu().then((data) => {
      setMenu(data);
      const cats = deriveCategories(data);
      if (cats.length > 0) setActiveCategory(cats[0]);
    }).catch(() => {});
    fetchCustomers().then(setCustomers).catch(() => {});
    const id = setInterval(() => {
      fetchMenu().then((data) => {
        setMenu(data);
      }).catch(() => {});
      fetchCustomers().then(setCustomers).catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.names.some((n) => n.toLowerCase().includes(q)) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [search, customers]);

  const filteredMenu = menu.filter(
    (m) => m.category === activeCategory && m.is_available !== false
  );

  const calculateItemPrice = (item: MenuItem, options: Record<string, string>) => {
    let total = item.base_price_cents;
    if (item.options) {
      for (const opt of item.options) {
        const selected = options[opt.name];
        const choice = opt.choices.find((c) => c.label === selected);
        if (choice) total += choice.extra_cents;
      }
    }
    return total;
  };

  const handleSelectItem = (item: MenuItem) => {
    if (!item.options || item.options.length === 0) {
      addToCart(item, {});
      return;
    }
    const defaults: Record<string, string> = {};
    for (const opt of item.options) {
      defaults[opt.name] = opt.choices[0]?.label || "";
    }
    setSelectedOptions(defaults);
    setSelectedItem(item);
  };

  const addToCart = (item: MenuItem, options: Record<string, string>) => {
    const unitCents = calculateItemPrice(item, options);
    setCart((prev) => [
      ...prev,
      { menuItem: item, options, quantity: 1, unitCents },
    ]);
  };

  const updateCartQuantity = (idx: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setCart((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, quantity: qty } : item))
      );
    }
  };

  const totalCents = cart.reduce(
    (sum, item) => sum + item.unitCents * item.quantity,
    0
  );
  const availableRewards = selectedCustomer
    ? selectedCustomer.rewards_earned - selectedCustomer.rewards_redeemed
    : 0;

  const handleCompleteOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const customerName = selectedCustomer
        ? selectedCustomer.names[0]
        : "Walk-in";
      const items: OrderItem[] = cart.map((ci) => ({
        menu_item_id: ci.menuItem.id,
        item_name: ci.menuItem.name,
        quantity: ci.quantity,
        price_cents: ci.unitCents,
        options: ci.options,
      }));

      await createOrder({
        customer_id: selectedCustomer?.id || null,
        customer_name: customerName,
        items,
        total_cents: freeReward ? 0 : totalCents,
        is_free_reward: freeReward,
        notes: "",
        created_by: "owner",
      });

      addToast(`Order created for ${customerName}`, "success");
      setCart([]);
      setSelectedCustomer(null);
      setSearch("");
      setFreeReward(false);
      onOrderCreated();
      // Refresh customers to get updated visit counts
      fetchCustomers().then(setCustomers).catch(() => {});
    } catch {
      addToast("Failed to create order", "error");
    } finally {
      setPlacing(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newName.trim()) return;
    setCreatingCustomer(true);
    try {
      const result = await checkRewards({
        ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
        name: newName.trim(),
      });
      if (result.customer) {
        setSelectedCustomer(result.customer);
        if (!customers.find((c) => c.id === result.customer!.id)) {
          setCustomers((prev) => [...prev, result.customer!]);
        }
      }
      setShowNewCustomer(false);
      setNewName("");
      setNewPhone("");
      addToast("Customer added", "success");
    } catch {
      addToast("Failed to create customer", "error");
    } finally {
      setCreatingCustomer(false);
    }
  };

  const formatPrice = (cents: number) =>
    `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

  return (
    <div className="grid md:grid-cols-5 gap-4">
      {/* Left: Menu Grid */}
      <div className="md:col-span-3">
        <div className="flex gap-2 mb-3 overflow-x-auto">
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredMenu.map((item) => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelectItem(item)}
              className="p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-left hover:shadow-md transition-all overflow-hidden"
            >
              {item.has_image && (
                <img
                  src={getMenuImageUrl(item.id)}
                  alt=""
                  className="w-full h-16 object-cover rounded-lg mb-1.5"
                  loading="lazy"
                />
              )}
              <p className="font-bold text-sm text-stone-800 dark:text-stone-200 truncate">
                {item.name}
              </p>
              <p className="text-brand-olive font-bold text-sm mt-1">
                {formatPrice(item.base_price_cents)}
              </p>
              {item.options && item.options.length > 0 && (
                <p className="text-[10px] text-stone-400 mt-0.5 truncate">
                  {item.options.map((o) => o.name).join(" · ")}
                </p>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Right: Cart + Customer */}
      <div className="md:col-span-2 flex flex-col gap-3">
        {/* Customer lookup */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-300 dark:border-stone-700 p-4">
          <h3 className="font-bold text-xs text-stone-500 uppercase tracking-wider mb-2">
            Customer
          </h3>
          {selectedCustomer ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-stone-800 dark:text-stone-200">
                  {selectedCustomer.names[0]}
                </p>
                <p className="text-xs text-stone-400">
                  {selectedCustomer.visit_count}/{REWARD_THRESHOLD} visits
                  {availableRewards > 0 &&
                    ` · ${availableRewards} reward${
                      availableRewards > 1 ? "s" : ""
                    }`}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setSearch("");
                  setFreeReward(false);
                }}
                className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-brand-olive outline-none"
                />
              </div>
              {filteredCustomers.length > 0 && (
                <div className="mt-2 space-y-1">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setSearch("");
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                    >
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                        {c.names[0]}
                      </p>
                      <p className="text-xs text-stone-400">
                        {[c.phone, c.email].filter(Boolean).join(" · ") ||
                          "No contact"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setShowNewCustomer(true)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  <UserPlus className="w-3 h-3" />
                  New
                </button>
                <button
                  onClick={() => setSearch("")}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  <User className="w-3 h-3" />
                  Walk-in
                </button>
              </div>
            </>
          )}
        </div>

        {/* Cart */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-300 dark:border-stone-700 p-4 flex-1">
          <h3 className="font-bold text-xs text-stone-500 uppercase tracking-wider mb-3">
            Cart
          </h3>
          {cart.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">
              Tap menu items to add
            </p>
          ) : (
            <div className="space-y-2 mb-3">
              {cart.map((ci, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
                      {ci.menuItem.name}
                    </p>
                    {Object.keys(ci.options).length > 0 && (
                      <p className="text-xs text-stone-400 truncate">
                        {Object.values(ci.options).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCartQuantity(idx, ci.quantity - 1)}
                      className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-400"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-stone-800 dark:text-stone-200">
                      {ci.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQuantity(idx, ci.quantity + 1)}
                      className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-400"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-stone-800 dark:text-stone-200 w-14 text-right">
                    {formatPrice(ci.unitCents * ci.quantity)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Free drink toggle */}
          {availableRewards > 0 && cart.length > 0 && (
            <label className="flex items-center gap-2 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={freeReward}
                onChange={(e) => setFreeReward(e.target.checked)}
                className="accent-amber-500"
              />
              <Gift className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                Apply Free Drink
              </span>
            </label>
          )}

          {/* Total + Complete */}
          {cart.length > 0 && (
            <>
              <div className="flex justify-between items-center py-2 border-t border-stone-100 dark:border-stone-800 mb-3">
                <span className="font-bold text-stone-600 dark:text-stone-400">
                  Total
                </span>
                <span className="font-black text-lg text-stone-800 dark:text-stone-200">
                  {freeReward ? (
                    <>
                      <s className="text-stone-400 text-sm mr-1">
                        {formatPrice(totalCents)}
                      </s>
                      <span className="text-green-600">FREE</span>
                    </>
                  ) : (
                    formatPrice(totalCents)
                  )}
                </span>
              </div>
              <button
                onClick={handleCompleteOrder}
                disabled={placing}
                className="w-full py-3 rounded-xl bg-brand-orange text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {placing ? "Processing..." : "Complete Order"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Options modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-[var(--bg-color)] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
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
                onClick={() => {
                  if (selectedItem) {
                    addToCart(selectedItem, selectedOptions);
                    setSelectedItem(null);
                    setSelectedOptions({});
                  }
                }}
                className="w-full py-3 rounded-xl bg-brand-olive text-white font-bold text-lg shadow-lg mt-2"
              >
                Add to Order ·{" "}
                {formatPrice(calculateItemPrice(selectedItem, selectedOptions))}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Customer modal */}
      <Modal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        title="New Customer"
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 block">
              Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Customer name"
              className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 block">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
            />
          </div>
          <button
            onClick={handleCreateCustomer}
            disabled={creatingCustomer || !newName.trim()}
            className="w-full py-3 rounded-xl bg-brand-orange text-white font-bold shadow-lg disabled:opacity-50"
          >
            {creatingCustomer ? "Creating..." : "Add Customer"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
