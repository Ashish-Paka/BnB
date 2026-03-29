import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  ChevronLeft,
  Edit3,
  Save,
  Users,
  Coffee,
  Gift,
  Calendar,
  Merge,
  Check,
  UserPlus,
  Trash2,
} from "lucide-react";
import {
  fetchCustomers,
  fetchCustomer,
  updateCustomer,
  mergeCustomers,
  checkRewards,
  deleteCustomer,
} from "../../lib/api";
import type { Customer, Order, Visit } from "../../lib/types";
import { REWARD_THRESHOLD, ORDER_STATUS_LABELS } from "../../lib/constants";

interface Props {
  addToast: (msg: string, type: "success" | "error") => void;
}

export default function CustomersTab({ addToast }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Detail view
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    customer: Customer;
    orders: Order[];
    visits: Visit[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editNames, setEditNames] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editVisitCount, setEditVisitCount] = useState(0);
  const [editTotalVisits, setEditTotalVisits] = useState(0);
  const [editRewardsEarned, setEditRewardsEarned] = useState(0);
  const [editRewardsRedeemed, setEditRewardsRedeemed] = useState(0);
  const [saving, setSaving] = useState(false);

  // Merge mode
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  // Add customer
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchCustomers()
      .then(setCustomers)
      .catch(() => {})
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      fetchCustomers().then(setCustomers).catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    fetchCustomer(selectedId)
      .then((d) => {
        setDetail(d);
        setEditNames(d.customer.names.join(", "));
        setEditPhone(d.customer.phone || "");
        setEditEmail(d.customer.email || "");
        setEditVisitCount(d.customer.visit_count);
        setEditTotalVisits(d.customer.total_visits);
        setEditRewardsEarned(d.customer.rewards_earned);
        setEditRewardsRedeemed(d.customer.rewards_redeemed);
      })
      .catch(() => addToast("Failed to load customer", "error"))
      .finally(() => setDetailLoading(false));
    const id = setInterval(() => {
      fetchCustomer(selectedId).then((d) => {
        setDetail(d);
        if (!editing) {
          setEditVisitCount(d.customer.visit_count);
          setEditTotalVisits(d.customer.total_visits);
          setEditRewardsEarned(d.customer.rewards_earned);
          setEditRewardsRedeemed(d.customer.rewards_redeemed);
        }
      }).catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, [selectedId, editing]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.names.some((n) => n.toLowerCase().includes(q)) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [search, customers]);

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const names = editNames
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      await updateCustomer(detail.customer.id, {
        names: names.length > 0 ? names : detail.customer.names,
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        visit_count: editVisitCount,
        total_visits: editTotalVisits,
        rewards_earned: editRewardsEarned,
        rewards_redeemed: editRewardsRedeemed,
      });
      // Refresh
      const updated = await fetchCustomer(detail.customer.id);
      setDetail(updated);
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === detail.customer.id ? updated.customer : c
        )
      );
      setEditing(false);
      addToast("Customer updated", "success");
    } catch {
      addToast("Failed to update", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleMerge = async () => {
    if (mergeSelection.length !== 2) return;
    const a = customers.find((c) => c.id === mergeSelection[0]);
    const b = customers.find((c) => c.id === mergeSelection[1]);
    if (!a || !b) {
      addToast("Selected customers not found", "error");
      return;
    }
    setMerging(true);
    try {
      await mergeCustomers(mergeSelection[0], mergeSelection[1]);
      addToast(
        `Merged ${b.names[0]} into ${a.names[0]}`,
        "success"
      );
      setMergeMode(false);
      setMergeSelection([]);
      // Refresh list
      const updated = await fetchCustomers();
      setCustomers(updated);
    } catch (err: any) {
      const msg = err?.message || "Failed to merge";
      addToast(`Merge failed: ${msg}`, "error");
    } finally {
      setMerging(false);
    }
  };

  const toggleMergeSelect = (id: string) => {
    setMergeSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleAddCustomer = async () => {
    if (!addName.trim()) return;
    setAdding(true);
    try {
      const result = await checkRewards({
        name: addName.trim(),
        ...(addPhone.trim() ? { phone: addPhone.trim() } : {}),
        ...(addEmail.trim() ? { email: addEmail.trim() } : {}),
      });
      if (result.customer) {
        setCustomers((prev) =>
          prev.find((c) => c.id === result.customer!.id)
            ? prev
            : [...prev, result.customer!]
        );
        addToast(`Customer "${addName.trim()}" added`, "success");
      }
      setShowAddCustomer(false);
      setAddName("");
      setAddPhone("");
      setAddEmail("");
    } catch {
      addToast("Failed to create customer", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    setDeleting(true);
    try {
      await deleteCustomer(detail.customer.id);
      addToast(`Deleted "${detail.customer.names[0]}"`, "success");
      setCustomers((prev) => prev.filter((c) => c.id !== detail.customer.id));
      setSelectedId(null);
      setDetail(null);
      setConfirmDelete(false);
    } catch (err: any) {
      addToast(`Delete failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setDeleting(false);
    }
  };

  const formatPrice = (cents: number) =>
    `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

  // Detail view
  if (selectedId) {
    if (detailLoading || !detail) {
      return (
        <div className="text-center py-12 text-stone-400">
          Loading customer...
        </div>
      );
    }

    const c = detail.customer;
    const availableRewards = c.rewards_earned - c.rewards_redeemed;

    return (
      <div>
        {/* Back button */}
        <button
          onClick={() => {
            setSelectedId(null);
            setDetail(null);
            setEditing(false);
          }}
          className="flex items-center gap-1 text-sm font-bold text-brand-orange mb-4 hover:opacity-80"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to list
        </button>

        {/* Customer info card */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-300 dark:border-stone-700 shadow-sm p-5 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              {editing ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                      Names (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={editNames}
                      onChange={(e) => setEditNames(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                        Visits (current)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={REWARD_THRESHOLD}
                        value={editVisitCount}
                        onChange={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0);
                          const diff = v - editVisitCount;
                          setEditVisitCount(v);
                          setEditTotalVisits((prev) => Math.max(0, prev + diff));
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                        Lifetime Visits
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editTotalVisits}
                        onChange={(e) => setEditTotalVisits(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                        Rewards Earned
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editRewardsEarned}
                        onChange={(e) => setEditRewardsEarned(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                        Rewards Redeemed
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editRewardsRedeemed}
                        onChange={(e) => setEditRewardsRedeemed(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-serif text-2xl font-black text-stone-800 dark:text-stone-200">
                    {c.names[0]}
                  </h2>
                  {c.names.length > 1 && (
                    <p className="text-sm text-stone-400">
                      aka {c.names.slice(1).join(", ")}
                    </p>
                  )}
                  <p className="text-sm text-stone-500 mt-1">
                    {[c.phone, c.email].filter(Boolean).join(" · ") ||
                      "No contact info"}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    Customer since {formatDate(c.created_at)}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {editing ? (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-brand-olive text-white text-sm font-bold disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "..." : "Save"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-400 hover:text-red-500 transition-colors"
                    title="Delete customer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3 text-center">
              <Coffee className="w-4 h-4 mx-auto text-brand-olive mb-1" />
              <p className="text-lg font-black text-stone-800 dark:text-stone-200">
                {c.visit_count}/{REWARD_THRESHOLD}
              </p>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">
                Visits
              </p>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3 text-center">
              <Gift className="w-4 h-4 mx-auto text-amber-500 mb-1" />
              <p className="text-lg font-black text-stone-800 dark:text-stone-200">
                {availableRewards}
              </p>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">
                Rewards
              </p>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3 text-center">
              <Calendar className="w-4 h-4 mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-black text-stone-800 dark:text-stone-200">
                {c.total_visits}
              </p>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">
                Lifetime
              </p>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-1">
                  Delete {c.names[0]}?
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                  This will remove all their visit history. Orders will be kept but unlinked.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Order history */}
        <h3 className="font-bold text-stone-400 text-sm uppercase tracking-wider mb-2">
          Orders ({detail.orders.length})
        </h3>
        {detail.orders.length === 0 ? (
          <p className="text-stone-400 text-sm py-4">No orders yet</p>
        ) : (
          <div className="space-y-2 mb-6">
            {detail.orders.slice(0, 20).map((order) => (
              <div
                key={order.id}
                className="p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/30 dark:border-stone-700/30"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm font-medium text-stone-600 dark:text-stone-400">
                      {order.items.map((i) => i.item_name).join(", ")}
                    </span>
                    {order.is_free_reward && (
                      <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                        Free
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-stone-600 dark:text-stone-400">
                    {formatPrice(order.total_cents)}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {formatDate(order.created_at)} at{" "}
                  {formatTime(order.created_at)} ·{" "}
                  {ORDER_STATUS_LABELS[order.status]}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Visit history */}
        <h3 className="font-bold text-stone-400 text-sm uppercase tracking-wider mb-2">
          Verified Visits ({detail.visits.length})
        </h3>
        {detail.visits.length === 0 ? (
          <p className="text-stone-400 text-sm py-4">No verified visits yet</p>
        ) : (
          <div className="space-y-1">
            {detail.visits.slice(0, 20).map((visit) => (
              <div
                key={visit.id}
                className="py-2 px-3 rounded-lg bg-white dark:bg-stone-900 border border-stone-200/30 dark:border-stone-700/30 flex justify-between items-center"
              >
                <span className="text-sm text-stone-600 dark:text-stone-400">
                  {formatDate(visit.date)}
                </span>
                <span className="text-xs text-stone-400">
                  {formatTime(visit.verified_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div>
      {/* Search + actions */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
          />
        </div>
        <button
          onClick={() => setShowAddCustomer(true)}
          className="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 bg-brand-olive text-white hover:bg-brand-olive/90"
        >
          <UserPlus className="w-3 h-3" />
          Add
        </button>
        <button
          onClick={() => {
            setMergeMode(!mergeMode);
            setMergeSelection([]);
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
            mergeMode
              ? "bg-brand-orange text-white"
              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
          }`}
        >
          <Merge className="w-3 h-3" />
          Merge
        </button>
      </div>

      {/* Add customer form */}
      <AnimatePresence>
        {showAddCustomer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-3 p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-sm">
              <h4 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-3">New Customer</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Name *"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                  />
                  <input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="Email (optional)"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleAddCustomer}
                    disabled={adding || !addName.trim()}
                    className="px-4 py-2 rounded-xl bg-brand-olive text-white text-xs font-bold disabled:opacity-50"
                  >
                    {adding ? "Adding..." : "Add Customer"}
                  </button>
                  <button
                    onClick={() => { setShowAddCustomer(false); setAddName(""); setAddPhone(""); setAddEmail(""); }}
                    className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Merge bar */}
      <AnimatePresence>
        {mergeMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
              {mergeSelection.length < 2 ? (
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                  Select 2 customers to merge.{" "}
                  <span className="text-amber-500">
                    ({mergeSelection.length}/2 selected)
                  </span>
                </p>
              ) : (() => {
                const a = customers.find((c) => c.id === mergeSelection[0]);
                const b = customers.find((c) => c.id === mergeSelection[1]);
                if (!a || !b) return null;
                const mergedNames = [...new Set([...a.names, ...b.names])];
                return (
                  <div>
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-2">
                      Merge preview:
                    </p>
                    <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1 mb-3">
                      <p>
                        <span className="font-bold">Names:</span>{" "}
                        {mergedNames.join(", ")}
                      </p>
                      <p>
                        <span className="font-bold">Phone:</span>{" "}
                        {a.phone || b.phone || "—"}
                      </p>
                      <p>
                        <span className="font-bold">Email:</span>{" "}
                        {a.email || b.email || "—"}
                      </p>
                      <p>
                        <span className="font-bold">Visits:</span>{" "}
                        {a.visit_count} + {b.visit_count} = {a.visit_count + b.visit_count}
                        {" · "}
                        <span className="font-bold">Lifetime:</span>{" "}
                        {a.total_visits + b.total_visits}
                        {" · "}
                        <span className="font-bold">Rewards:</span>{" "}
                        {a.rewards_earned + b.rewards_earned} earned, {a.rewards_redeemed + b.rewards_redeemed} used
                      </p>
                    </div>
                    <p className="text-[10px] text-amber-500 mb-2">
                      {b.names[0]}'s orders & visits will move to {a.names[0]}. {b.names[0]} will be deleted.
                    </p>
                    <button
                      onClick={handleMerge}
                      disabled={merging}
                      className="px-4 py-2 rounded-lg bg-brand-orange text-white text-xs font-bold disabled:opacity-50"
                    >
                      {merging ? "Merging..." : "Confirm Merge"}
                    </button>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <p className="text-center text-stone-400 py-12">
          Loading customers...
        </p>
      ) : filteredCustomers.length === 0 ? (
        <p className="text-center text-stone-400 py-12">
          {search ? "No matching customers" : "No customers yet"}
        </p>
      ) : (
        <div className="grid gap-2">
          {filteredCustomers.map((c) => {
            const isSelected = mergeSelection.includes(c.id);
            return (
              <motion.button
                key={c.id}
                layout
                onClick={() => {
                  if (mergeMode) {
                    toggleMergeSelect(c.id);
                  } else {
                    setSelectedId(c.id);
                  }
                }}
                className={`w-full text-left p-4 rounded-2xl bg-white dark:bg-stone-900 border shadow-sm transition-all ${
                  isSelected
                    ? "border-brand-orange ring-2 ring-brand-orange/30"
                    : "border-stone-300 dark:border-stone-700 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {mergeMode && (
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? "border-brand-orange bg-brand-orange"
                            : "border-stone-300 dark:border-stone-600"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-stone-800 dark:text-stone-200">
                        {c.names[0]}
                        {c.names.length > 1 && (
                          <span className="text-xs text-stone-400 ml-1">
                            aka {c.names.slice(1).join(", ")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-stone-400">
                        {[c.phone, c.email].filter(Boolean).join(" · ") ||
                          "No contact info"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-orange">
                      {c.visit_count}/{REWARD_THRESHOLD}
                    </p>
                    <p className="text-xs text-stone-400">
                      {c.rewards_earned - c.rewards_redeemed} reward
                      {c.rewards_earned - c.rewards_redeemed !== 1
                        ? "s"
                        : ""}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
