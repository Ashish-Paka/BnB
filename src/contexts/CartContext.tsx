import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { MenuItem, CartItem } from "../lib/types";

interface CartContextType {
  items: CartItem[];
  addItem: (menuItem: MenuItem, options: Record<string, string[]>) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  totalCents: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

function calculateItemTotal(menuItem: MenuItem, options: Record<string, string[]>): number {
  let total = menuItem.base_price_cents;
  if (menuItem.options) {
    for (const opt of menuItem.options) {
      const selected = options[opt.name] || [];
      for (const label of selected) {
        const choice = opt.choices.find((c) => c.label === label);
        if (choice) total += choice.extra_cents;
      }
    }
  }
  return total;
}

/** Migrate old cart format (Record<string, string>) to new (Record<string, string[]>) */
function migrateCartItems(items: CartItem[]): CartItem[] {
  return items.map((item) => {
    const opts = item.selected_options;
    const needsMigration = Object.values(opts).some((v) => typeof v === "string");
    if (!needsMigration) return item;
    const migrated: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(opts)) {
      migrated[key] = typeof val === "string" ? (val ? [val] : []) : val;
    }
    return { ...item, selected_options: migrated };
  });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("bnb_cart");
      if (!saved) return [];
      return migrateCartItems(JSON.parse(saved));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("bnb_cart", JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((menuItem: MenuItem, options: Record<string, string[]>) => {
    const total = calculateItemTotal(menuItem, options);
    setItems((prev) => [...prev, { menu_item: menuItem, quantity: 1, selected_options: options, total_cents: total }]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity } : item)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalCents = items.reduce((sum, item) => sum + item.total_cents * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalCents, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
