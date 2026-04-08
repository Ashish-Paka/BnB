import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingBag,
  Receipt,
  Users,
  UtensilsCrossed,
  QrCode,
  Settings,
  LogOut,
  Trash2,
  RotateCcw,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { verifyAuth, fetchOrders, updateOrder, deleteOrder, restoreOrder, fetchAllOrders, permanentlyDeleteOrder, exportBackupOnline, fetchBackupStatus } from "../lib/api";
import type { Order } from "../lib/types";
import { ORDER_STATUS_LABELS } from "../lib/constants";
import DashboardLoginPage from "./DashboardLoginPage";
import Toast, { useToasts } from "../components/ui/Toast";
import POSTab from "../components/dashboard/POSTab";
import CustomersTab from "../components/dashboard/CustomersTab";
import MenuTab from "../components/dashboard/MenuTab";
import OTPTab from "../components/dashboard/OTPTab";
import SettingsTab from "../components/dashboard/SettingsTab";

type Tab = "otp" | "orders" | "pos" | "customers" | "menu" | "settings";

type OrderSourceFilter = "all" | "customer" | "owner";
type OrderStatusFilter =
  | "all"
  | "active"
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";
type OrderDateFilter = "all" | "today" | "last7" | "last30";
const ACTIVE_ORDER_STATUSES = new Set<Order["status"]>(["pending", "preparing", "ready"]);

function sortOrdersByDate(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function matchesDateFilter(order: Order, filter: OrderDateFilter): boolean {
  if (filter === "all") return true;
  const createdAt = new Date(order.created_at);
  const now = new Date();

  if (filter === "today") {
    return createdAt.toDateString() === now.toDateString();
  }

  const days = filter === "last7" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return createdAt >= cutoff;
}

export default function DashboardPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("otp");
  const { toasts, addToast, dismissToast } = useToasts();

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  const isFirstRenderDark = useRef(true);

  useEffect(() => {
    if (isFirstRenderDark.current) {
      isFirstRenderDark.current = false;
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", isDarkMode ? "dark" : "light");
      return;
    }
    document.documentElement.classList.add("theme-transitioning");
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    const timeout = setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning");
    }, 450);
    return () => {
      clearTimeout(timeout);
    };
  }, [isDarkMode]);

  // Auto-backup state (lives here so it persists across tab switches)
  const [lastOnlineBackup, setLastOnlineBackup] = useState<string | null>(null);

  // Auto-backup: runs as long as dashboard is open, regardless of active tab
  useEffect(() => {
    if (!authed) return;

    fetchBackupStatus()
      .then((s) => { if (s.exported_at) setLastOnlineBackup(s.exported_at); })
      .catch(() => {});

    const runAutoBackup = async () => {
      try {
        await exportBackupOnline();
        setLastOnlineBackup(new Date().toISOString());
      } catch {}
    };

    const timeout = setTimeout(runAutoBackup, 5000);
    const interval = setInterval(runAutoBackup, 1800000); // 30 minutes
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [authed]);

  // Orders data
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const prevPendingRef = useRef(-1);

  // Order detail view
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSourceFilter, setOrderSourceFilter] = useState<OrderSourceFilter>("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>("all");
  const [orderDateFilter, setOrderDateFilter] = useState<OrderDateFilter>("all");
  const [showOrderFilters, setShowOrderFilters] = useState(false);

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
          setOrders(sortOrdersByDate(newOrders));
        })
        .catch(() => {});
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [authed, playPing, addToast]);

  // Load all orders (including deleted) when deleted section is opened
  useEffect(() => {
    if (showDeleted && authed) {
      fetchAllOrders().then((data) => setAllOrders(sortOrdersByDate(data))).catch(() => {});
    }
  }, [showDeleted, authed]);

  const handleStatusChange = async (
    orderId: string,
    newStatus: Order["status"]
  ) => {
    try {
      await updateOrder(orderId, { status: newStatus });
      setOrders((prev) =>
        sortOrdersByDate(prev.map((o) =>
          o.id === orderId ? { ...o, status: newStatus } : o
        ))
      );
      addToast(`Order updated to ${newStatus}`, "success");
    } catch {
      addToast("Failed to update order", "error");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setAllOrders((prev) =>
        sortOrdersByDate(prev.map((o) =>
          o.id === orderId ? { ...o, deleted_at: new Date().toISOString() } : o
        ))
      );
      addToast("Order removed from list", "success");
    } catch {
      addToast("Failed to delete order", "error");
    }
  };

  const handleRestoreOrder = async (orderId: string) => {
    try {
      const restored = await restoreOrder(orderId);
      setAllOrders((prev) =>
        sortOrdersByDate(prev.map((o) =>
          o.id === orderId ? { ...o, deleted_at: null } : o
        ))
      );
      setOrders((prev) => sortOrdersByDate([...prev, restored]));
      addToast("Order restored", "success");
    } catch {
      addToast("Failed to restore order", "error");
    }
  };

  const handlePermanentDelete = async (orderId: string) => {
    try {
      await permanentlyDeleteOrder(orderId);
      setAllOrders((prev) => prev.filter((o) => o.id !== orderId));
      addToast("Order permanently deleted", "success");
    } catch {
      addToast("Failed to delete order", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("owner_token");
    setAuthed(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)]">
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
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const normalizedOrderSearch = orderSearch.trim().toLowerCase();
  const hasOrderFilters =
    normalizedOrderSearch.length > 0 ||
    orderSourceFilter !== "all" ||
    orderStatusFilter !== "all" ||
    orderDateFilter !== "all";

  const orderMatchesFilters = (order: Order, includeDeleted = false) => {
    if (!includeDeleted && order.deleted_at) return false;
    if (includeDeleted && !order.deleted_at) return false;

    if (normalizedOrderSearch) {
      const searchFields = [
        order.customer_name,
        order.id,
        order.notes,
        order.created_by === "owner" ? "pos" : "online",
        ...order.items.flatMap((item) => [
          item.item_name,
          ...Object.values(item.options),
        ]),
      ].filter((value): value is string => typeof value === "string" && value.length > 0)
        .map((value) => value.toLowerCase());

      if (!searchFields.some((value) => value.includes(normalizedOrderSearch))) {
        return false;
      }
    }

    if (orderSourceFilter !== "all" && order.created_by !== orderSourceFilter) {
      return false;
    }

    if (orderStatusFilter !== "all") {
      if (orderStatusFilter === "active") {
        if (!ACTIVE_ORDER_STATUSES.has(order.status)) return false;
      } else if (order.status !== orderStatusFilter) {
        return false;
      }
    }

    return matchesDateFilter(order, orderDateFilter);
  };

  const activeOrders = orders.filter(
    (o) => ACTIVE_ORDER_STATUSES.has(o.status) && orderMatchesFilters(o)
  );
  const pastOrders = orders.filter(
    (o) => (o.status === "completed" || o.status === "cancelled") && orderMatchesFilters(o)
  );
  const deletedOrders = allOrders.filter((o) => orderMatchesFilters(o, true));

  const tabs: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { id: "otp", label: "QR", icon: <QrCode className="w-5 h-5" /> },
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
    { id: "settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
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

  // Render an order card (shared between active and past)
  const renderOrderCard = (order: Order, isActive: boolean) => (
    <motion.div
      key={order.id}
      layout
      className={`p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-sm ${!isActive ? "opacity-80" : ""}`}
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
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
      </div>
      <div className="space-y-1 mb-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-stone-600 dark:text-stone-400">
              {item.quantity}x {item.item_name}
              {Object.keys(item.options).length > 0 && (
                <span className="text-stone-400 text-xs ml-1">
                  ({Object.values(item.options).map(v => Array.isArray(v) ? v.join(", ") : v).filter(Boolean).join("; ")})
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewingOrder(order)}
            className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteOrder(order.id)}
            className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
            title="Delete order"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {isActive && nextStatus[order.status] && (
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
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-color)]">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[var(--bg-color-95)] backdrop-blur-md border-b border-stone-300 dark:border-stone-700">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-serif text-xl font-black text-stone-800 dark:text-stone-200">
            Bones & Bru
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
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
        {/* QR/OTP TAB (first) */}
        {activeTab === "otp" && <OTPTab />}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div>
            <div className="mb-5 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search customer, item, notes, or order ID..."
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 shadow-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <button
                  onClick={() => setShowOrderFilters((prev) => !prev)}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-sm font-bold transition-colors ${
                    showOrderFilters || hasOrderFilters
                      ? "border-brand-orange bg-brand-orange/10 text-brand-orange"
                      : "border-stone-300 dark:border-stone-700 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showOrderFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-3 sm:grid-cols-3 p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-sm">
                      <label className="text-sm font-medium text-stone-600 dark:text-stone-300">
                        <span className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">Source</span>
                        <select
                          value={orderSourceFilter}
                          onChange={(e) => setOrderSourceFilter(e.target.value as OrderSourceFilter)}
                          className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-orange"
                        >
                          <option value="all">All sources</option>
                          <option value="customer">Online</option>
                          <option value="owner">POS</option>
                        </select>
                      </label>

                      <label className="text-sm font-medium text-stone-600 dark:text-stone-300">
                        <span className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">Status</span>
                        <select
                          value={orderStatusFilter}
                          onChange={(e) => setOrderStatusFilter(e.target.value as OrderStatusFilter)}
                          className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-orange"
                        >
                          <option value="all">All statuses</option>
                          <option value="active">Active only</option>
                          <option value="pending">Pending</option>
                          <option value="preparing">Preparing</option>
                          <option value="ready">Ready</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </label>

                      <label className="text-sm font-medium text-stone-600 dark:text-stone-300">
                        <span className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">Date</span>
                        <select
                          value={orderDateFilter}
                          onChange={(e) => setOrderDateFilter(e.target.value as OrderDateFilter)}
                          className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-orange"
                        >
                          <option value="all">All time</option>
                          <option value="today">Today</option>
                          <option value="last7">Last 7 days</option>
                          <option value="last30">Last 30 days</option>
                        </select>
                      </label>

                      {hasOrderFilters && (
                        <div className="sm:col-span-3 flex justify-end">
                          <button
                            onClick={() => {
                              setOrderSearch("");
                              setOrderSourceFilter("all");
                              setOrderStatusFilter("all");
                              setOrderDateFilter("all");
                            }}
                            className="text-sm font-bold text-brand-orange hover:opacity-80"
                          >
                            Clear filters
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {activeOrders.length === 0 && (
              <p className="text-center text-stone-400 py-12">
                {hasOrderFilters ? "No orders match the current filters" : "No active orders"}
              </p>
            )}
            <div className="grid gap-3">
              {activeOrders.map((order) => renderOrderCard(order, true))}
            </div>

            {pastOrders.length > 0 && (
              <>
                <h3 className="font-bold text-stone-400 text-sm uppercase tracking-wider mt-8 mb-3">
                  Past Orders
                </h3>
                <div className="grid gap-2">
                  {pastOrders.slice(0, 20).map((order) => renderOrderCard(order, false))}
                </div>
              </>
            )}

            {/* Deleted Orders Section */}
            <div className="mt-8">
              <button
                onClick={() => setShowDeleted(!showDeleted)}
                className="flex items-center gap-2 text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-wider"
              >
                {showDeleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Deleted Orders ({deletedOrders.length})
              </button>
              <AnimatePresence>
                {showDeleted && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {deletedOrders.length === 0 ? (
                      <p className="text-center text-stone-400 py-6 text-sm">
                        No deleted orders
                      </p>
                    ) : (
                      <div className="grid gap-2 mt-3">
                        {deletedOrders.map((order) => (
                          <div
                            key={order.id}
                            className="p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200/30 dark:border-red-800/30 flex flex-col gap-2 opacity-70"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-stone-600 dark:text-stone-400 break-words">
                                  {order.customer_name}
                                </p>
                                <p className="text-xs text-stone-400">
                                  {order.items.length} item{order.items.length !== 1 ? "s" : ""} · {order.is_free_reward ? "FREE" : formatPrice(order.total_cents)}
                                </p>
                                <p className="text-xs text-red-400">
                                  Deleted {formatDate(order.deleted_at!)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => setViewingOrder(order)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 text-xs font-bold transition-colors"
                                title="View"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                              <button
                                onClick={() => handleRestoreOrder(order.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-olive/10 hover:bg-brand-olive text-brand-olive hover:text-white text-xs font-bold transition-all"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Restore
                              </button>
                              <button
                                onClick={() => handlePermanentDelete(order.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-600 text-red-600 hover:text-white text-xs font-bold transition-all dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* POS TAB */}
        {activeTab === "pos" && (
          <POSTab
            onOrderCreated={() => {
              fetchOrders().then(setOrders).catch(() => {});
            }}
            addToast={addToast}
          />
        )}

        {/* CUSTOMERS TAB */}
        {activeTab === "customers" && <CustomersTab addToast={addToast} />}

        {/* MENU TAB */}
        {activeTab === "menu" && <MenuTab addToast={addToast} />}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <SettingsTab
            addToast={addToast}
            lastOnlineBackup={lastOnlineBackup}
            setLastOnlineBackup={setLastOnlineBackup}
          />
        )}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {viewingOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setViewingOrder(null)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto bg-[var(--bg-color)] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-300 dark:border-stone-700"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-2">
                <h2 className="font-serif text-xl font-bold text-stone-800 dark:text-stone-200">
                  Order Details
                </h2>
                <button
                  onClick={() => setViewingOrder(null)}
                  className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-stone-800 dark:text-stone-200 text-lg">
                      {viewingOrder.customer_name}
                    </p>
                    <p className="text-xs text-stone-400">
                      {formatDate(viewingOrder.created_at)} · {viewingOrder.created_by === "owner" ? "POS" : "Online"}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[viewingOrder.status]}`}>
                    {ORDER_STATUS_LABELS[viewingOrder.status]}
                  </span>
                </div>

                {viewingOrder.is_free_reward && (
                  <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm font-bold">
                    Free Drink Reward
                  </div>
                )}

                {viewingOrder.deleted_at && (
                  <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold">
                    Deleted on {formatDate(viewingOrder.deleted_at)}
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Items</h4>
                  {viewingOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-300 dark:border-stone-700">
                      <div>
                        <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                          {item.quantity}x {item.item_name}
                        </p>
                        {Object.keys(item.options).length > 0 && (
                          <p className="text-xs text-stone-400">
                            {Object.values(item.options).join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="font-bold text-sm text-stone-800 dark:text-stone-200">
                        {formatPrice(item.price_cents * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-3 border-t border-stone-200 dark:border-stone-700">
                  <span className="font-bold text-stone-600 dark:text-stone-400">Total</span>
                  <span className="font-black text-xl text-stone-800 dark:text-stone-200">
                    {viewingOrder.is_free_reward ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      formatPrice(viewingOrder.total_cents)
                    )}
                  </span>
                </div>

                {viewingOrder.notes && (
                  <div>
                    <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Notes</h4>
                    <p className="text-sm text-stone-600 dark:text-stone-400">{viewingOrder.notes}</p>
                  </div>
                )}

                <p className="text-[10px] text-stone-300 dark:text-stone-600 font-mono break-all">
                  ID: {viewingOrder.id}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
