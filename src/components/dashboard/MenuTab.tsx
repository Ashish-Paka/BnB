import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Edit3, Trash2, Eye, EyeOff, X } from "lucide-react";
import { fetchMenu, manageMenuItem } from "../../lib/api";
import type { MenuItem, MenuItemOption } from "../../lib/types";
import { CATEGORIES, CATEGORY_LABELS } from "../../lib/constants";

interface Props {
  addToast: (msg: string, type: "success" | "error") => void;
}

interface FormState {
  name: string;
  description: string;
  base_price_cents: number;
  category: string;
  options: MenuItemOption[];
}

const emptyForm: FormState = {
  name: "",
  description: "",
  base_price_cents: 500,
  category: "coffee",
  options: [],
};

export default function MenuTab({ addToast }: Props) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [priceInput, setPriceInput] = useState("5.00");

  const loadMenu = () => {
    setLoading(true);
    fetchMenu()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPriceInput("5.00");
    setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      base_price_cents: item.base_price_cents,
      category: item.category,
      options: item.options || [],
    });
    setPriceInput((item.base_price_cents / 100).toFixed(2));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        base_price_cents: Math.round(parseFloat(priceInput) * 100) || 500,
        options: form.options.length > 0 ? form.options : undefined,
      };

      if (editingId) {
        await manageMenuItem("PUT", { id: editingId, ...data });
        addToast("Item updated", "success");
      } else {
        await manageMenuItem("POST", data);
        addToast("Item added", "success");
      }
      setShowForm(false);
      loadMenu();
    } catch {
      addToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await manageMenuItem("DELETE", { id: item.id });
      addToast("Item deleted", "success");
      loadMenu();
    } catch {
      addToast("Failed to delete", "error");
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await manageMenuItem("PUT", {
        id: item.id,
        is_available: !item.is_available,
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_available: !i.is_available } : i
        )
      );
      addToast(
        `${item.name} ${item.is_available ? "hidden" : "available"}`,
        "success"
      );
    } catch {
      addToast("Failed to update", "error");
    }
  };

  // Option management helpers
  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        { name: "", choices: [{ label: "", extra_cents: 0 }] },
      ],
    }));
  };

  const removeOption = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
    }));
  };

  const updateOptionName = (idx: number, name: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? { ...o, name } : o)),
    }));
  };

  const addChoice = (optIdx: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) =>
        i === optIdx
          ? { ...o, choices: [...o.choices, { label: "", extra_cents: 0 }] }
          : o
      ),
    }));
  };

  const removeChoice = (optIdx: number, choiceIdx: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) =>
        i === optIdx
          ? { ...o, choices: o.choices.filter((_, j) => j !== choiceIdx) }
          : o
      ),
    }));
  };

  const updateChoice = (
    optIdx: number,
    choiceIdx: number,
    field: "label" | "extra_cents",
    value: string | number
  ) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) =>
        i === optIdx
          ? {
              ...o,
              choices: o.choices.map((c, j) =>
                j === choiceIdx ? { ...c, [field]: value } : c
              ),
            }
          : o
      ),
    }));
  };

  const formatPrice = (cents: number) =>
    `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

  // Group items by category
  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl font-black text-stone-800 dark:text-stone-200">
          Menu Items
        </h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-brand-olive text-white text-sm font-bold shadow hover:shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {loading ? (
        <p className="text-center text-stone-400 py-12">Loading menu...</p>
      ) : (
        grouped.map((group) => (
          <div key={group.category} className="mb-6">
            <h3 className="font-bold text-stone-400 text-sm uppercase tracking-wider mb-2">
              {group.label}
            </h3>
            <div className="grid gap-2">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/50 dark:border-stone-700/50 shadow-sm flex items-center justify-between ${
                    item.is_available === false ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-stone-800 dark:text-stone-200">
                        {item.name}
                      </p>
                      {item.is_available === false && (
                        <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-500 truncate">
                      {item.description}
                    </p>
                    {item.options && item.options.length > 0 && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        {item.options.map((o) => o.name).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="font-bold text-brand-olive text-lg">
                      {formatPrice(item.base_price_cents)}
                    </span>
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 transition-colors"
                      title={
                        item.is_available === false
                          ? "Make available"
                          : "Hide item"
                      }
                    >
                      {item.is_available === false ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200/50 dark:border-stone-700/50"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-2">
                <h2 className="font-serif text-xl font-bold text-stone-800 dark:text-stone-200">
                  {editingId ? "Edit Item" : "New Item"}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 pb-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Latte"
                    className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Short description"
                    className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                  />
                </div>

                {/* Price + Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                      Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                      Category
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                      className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat] || cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Options */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                      Customization Options
                    </label>
                    <button
                      onClick={addOption}
                      className="text-xs font-bold text-brand-olive hover:opacity-80"
                    >
                      + Add Option
                    </button>
                  </div>

                  {form.options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className="mb-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <input
                          type="text"
                          value={opt.name}
                          onChange={(e) =>
                            updateOptionName(optIdx, e.target.value)
                          }
                          placeholder="Option name (e.g. Milk)"
                          className="flex-1 px-3 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none"
                        />
                        <button
                          onClick={() => removeOption(optIdx)}
                          className="ml-2 p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {opt.choices.map((choice, choiceIdx) => (
                        <div
                          key={choiceIdx}
                          className="flex items-center gap-2 mb-1"
                        >
                          <input
                            type="text"
                            value={choice.label}
                            onChange={(e) =>
                              updateChoice(
                                optIdx,
                                choiceIdx,
                                "label",
                                e.target.value
                              )
                            }
                            placeholder="Choice label"
                            className="flex-1 px-2 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 outline-none"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-stone-400">+$</span>
                            <input
                              type="number"
                              step="0.50"
                              min="0"
                              value={(choice.extra_cents / 100).toFixed(2)}
                              onChange={(e) =>
                                updateChoice(
                                  optIdx,
                                  choiceIdx,
                                  "extra_cents",
                                  Math.round(
                                    parseFloat(e.target.value || "0") * 100
                                  )
                                )
                              }
                              className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 outline-none"
                            />
                          </div>
                          <button
                            onClick={() => removeChoice(optIdx, choiceIdx)}
                            className="p-0.5 text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addChoice(optIdx)}
                        className="text-xs font-bold text-brand-olive hover:opacity-80 mt-1"
                      >
                        + Add Choice
                      </button>
                    </div>
                  ))}
                </div>

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="w-full py-3 rounded-xl bg-brand-olive text-white font-bold shadow-lg disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Add Item"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
