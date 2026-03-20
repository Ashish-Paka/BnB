import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import {
  ShoppingBag,
  Receipt,
  Users,
  UtensilsCrossed,
  QrCode,
  LogOut,
} from "lucide-react";
import { verifyAuth, fetchOrders, updateOrder } from "../lib/api";
import type { Order } from "../lib/types";
import { ORDER_STATUS_LABELS } from "../lib/constants";
import DashboardLoginPage from "./DashboardLoginPage";
import Toast, { useToasts } from "../components/ui/Toast";
import POSTab from "../components/dashboard/POSTab";
import CustomersTab from "../components/dashboard/CustomersTab";
import MenuTab from "../components/dashboard/MenuTab";
import OTPTab from "../components/dashboard/OTPTab";

type Tab = "orders" | "pos" | "customers" | "menu" | "otp";

export default function DashboardPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const { toasts, addToast, dismissToast } = useToasts();

  // Orders data (kept here since orders tab is inline + POS needs refresh)
  const [orders, setOrders] = useState<Order[]>([]);
  const prevPendingRef = useRef(-1);

  useEffect(() => {
    const token = localStorage.getItem("owner_token");
    if (token) {
      verifyAuth()
        .then((res) => setAuthed(res.valid))
        .catch(() => setAuthed(false))
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const playPing = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 800;
      gain.gain.value = 0.3;
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio not available
    }
  }, []);

  // Poll orders every 5 seconds
  useEffect(() => {
    if (!authed) return;
    const load = () =>
      fetchOrders()
        .then((newOrders) => {
          const newPending = newOrders.filter(
            (o) => o.status === "pending"
          ).length;
          if (prevPendingRef.current >= 0 && newPending > prevPendingRef.current) {
            playPing();
            addToast("New order received!", "info");
          }
          prevPendingRef.current = newPending;
          setOrders(newOrders);
        })
        .catch(() => {});
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [authed, playPing, addToast]);

  const handleStatusChange = async (
    orderId: string,
    newStatus: Order["status"]
  ) => {
    try {
      await updateOrder(orderId, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: newStatus } : o
        )
      );
      addToast(`Order updated to ${newStatus}`, "success");
    } catch {
      addToast("Failed to update order", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("owner_token");
    setAuthed(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  if (!authed) {
    return <DashboardLoginPage onLogin={() => setAuthed(true)} />;
  }

  const formatPrice = (cents: number) =>
    `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const activeOrders = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled"
  );
  const pastOrders = orders.filter(
    (o) => o.status === "completed" || o.status === "cancelled"
  );

  const tabs: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: "orders",
      label: "Orders",
      icon: <ShoppingBag className="w-5 h-5" />,
      badge: activeOrders.length || undefined,
    },
    {
      id: "pos",
      label: "POS",
      icon: <Receipt className="w-5 h-5" />,
    },
    {
      id: "customers",
      label: "Customers",
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: "menu",
      label: "Menu",
      icon: <UtensilsCrossed className="w-5 h-5" />,
    },
    { id: "otp", label: "OTP", icon: <QrCode className="w-5 h-5" /> },
  ];

  const nextStatus: Record<string, Order["status"] | null> = {
    pending: "preparing",
    preparing: "ready",
    ready: "completed",
  };

  const statusColors: Record<string, string> = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    preparing:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    ready:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    completed:
      "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
    cancelled:
      "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[var(--color-bg-light)]/95 dark:bg-[var(--color-bg-dark)]/95 backdrop-blur-md border-b border-stone-200/50 dark:border-stone-700/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-serif text-xl font-black text-stone-800 dark:text-stone-200">
            Bones & Bru
          </h1>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap min-w-0 ${
                activeTab === tab.id
                  ? "border-brand-orange text-brand-orange"
                  : "border-transparent text-stone-400 hover:text-stone-600"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && (
                <span className="w-5 h-5 bg-brand-orange text-white rounded-full text-xs font-black flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div>
            {activeOrders.length === 0 && (
              <p className="text-center text-stone-400 py-12">
                No active orders
              </p>
            )}
            <div className="grid gap-3">
              {activeOrders.map((order) => (
                <motion.div
                  key={order.id}
                  layout
                  className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/50 dark:border-stone-700/50 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-stone-800 dark:text-stone-200">
                        {order.customer_name}
                        {order.is_free_reward && (
                          <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                            Free Drink
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-stone-400">
                        {formatTime(order.created_at)} ·{" "}
                        {order.created_by === "owner" ? "POS" : "Online"}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[order.status]}`}
                    >
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-stone-600 dark:text-stone-400">
                          {item.quantity}x {item.item_name}
                          {Object.keys(item.options).length > 0 && (
                            <span className="text-stone-400 text-xs ml-1">
                              ({Object.values(item.options).join(", ")})
                            </span>
                          )}
                        </span>
                        <span className="text-stone-800 dark:text-stone-200 font-medium">
                          {formatPrice(item.price_cents * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200">
                      {order.is_free_reward ? (
                        <span className="text-green-600">FREE</span>
                      ) : (
                        formatPrice(order.total_cents)
                      )}
                    </span>
                    {nextStatus[order.status] && (
                      <button
                        onClick={() =>
                          handleStatusChange(
                            order.id,
                            nextStatus[order.status]!
                          )
                        }
                        className="px-4 py-2 rounded-xl bg-brand-orange text-white font-bold text-sm shadow hover:shadow-md transition-all"
                      >
                        Mark{" "}
                        {ORDER_STATUS_LABELS[nextStatus[order.status]!]}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {pastOrders.length > 0 && (
              <>
                <h3 className="font-bold text-stone-400 text-sm uppercase tracking-wider mt-8 mb-3">
                  Past Orders
                </h3>
                <div className="grid gap-2">
                  {pastOrders.slice(0, 20).map((order) => (
                    <div
                      key={order.id}
                      className="p-3 rounded-xl bg-white/50 dark:bg-stone-900/50 border border-stone-200/30 dark:border-stone-700/30 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-sm text-stone-600 dark:text-stone-400">
                          {order.customer_name}
                        </span>
                        <span className="text-xs text-stone-400 ml-2">
                          {order.items.length} item
                          {order.items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-600 dark:text-stone-400">
                          {order.is_free_reward
                            ? "FREE"
                            : formatPrice(order.total_cents)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[order.status]}`}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* POS TAB */}
        {activeTab === "pos" && (
          <POSTab
            onOrderCreated={() => {
              // Trigger immediate refresh of orders
              fetchOrders().then(setOrders).catch(() => {});
            }}
            addToast={addToast}
          />
        )}

        {/* CUSTOMERS TAB */}
        {activeTab === "customers" && <CustomersTab addToast={addToast} />}

        {/* MENU TAB */}
        {activeTab === "menu" && <MenuTab addToast={addToast} />}

        {/* OTP TAB */}
        {activeTab === "otp" && <OTPTab />}
      </div>
    </div>
  );
}
