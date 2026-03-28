import { useState, useEffect } from "react";
import { Clock, CheckCircle2, Flame, Coffee, XCircle } from "lucide-react";
import { fetchOrderHistory } from "../../lib/api";

interface HistoryOrder {
  id: string;
  items: { item_name: string; quantity: number; options: Record<string, string> }[];
  total_cents: number;
  status: string;
  is_free_reward: boolean;
  created_at: string;
}

interface Props {
  customerId: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Received", icon: Clock, color: "text-amber-500" },
  preparing: { label: "Preparing", icon: Flame, color: "text-orange-500" },
  ready: { label: "Ready", icon: Coffee, color: "text-green-500" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-stone-400" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-400" },
};

export default function OrderHistory({ customerId }: Props) {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderHistory(customerId)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      fetchOrderHistory(customerId).then(setOrders).catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, [customerId]);

  const formatPrice = (cents: number) =>
    `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return <p className="text-stone-400 text-sm text-center py-8">Loading orders...</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8">
        <Coffee className="w-10 h-10 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
        <p className="text-stone-500 dark:text-stone-400 text-sm">No orders yet</p>
        <p className="text-stone-400 dark:text-stone-500 text-xs mt-1">
          Place an in-cafe order to see it here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => {
        const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
        const Icon = cfg.icon;
        return (
          <div
            key={order.id}
            className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/50 dark:border-stone-700/50"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
              </div>
              <span className="text-xs text-stone-400">{formatDate(order.created_at)}</span>
            </div>
            <div className="space-y-1">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-baseline justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-stone-700 dark:text-stone-300">
                      {item.quantity > 1 && (
                        <span className="font-bold mr-1">{item.quantity}x</span>
                      )}
                      {item.item_name}
                    </span>
                    {Object.keys(item.options).length > 0 && (
                      <span className="text-xs text-stone-400 ml-1">
                        ({Object.values(item.options).join(", ")})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <span className="text-xs text-stone-400">Total</span>
              <span className="text-sm font-bold text-stone-700 dark:text-stone-300">
                {order.is_free_reward ? (
                  <span className="text-green-600">FREE</span>
                ) : (
                  formatPrice(order.total_cents)
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
