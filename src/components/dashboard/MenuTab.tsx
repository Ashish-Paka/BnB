import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Edit3, Trash2, Eye, EyeOff, X, Search, SlidersHorizontal } from "lucide-react";
import { fetchMenu, manageMenuItem, fetchPublicConfig, updateConfig, uploadMenuImage, deleteMenuItemImage, getMenuImageUrl } from "../../lib/api";
import { resizeImage } from "../../lib/image-utils";
import type { MenuItem, MenuItemOption } from "../../lib/types";
import { DEFAULT_CATEGORY, deriveCategories, categoryLabel } from "../../lib/constants";
import { ImagePlus, ImageOff } from "lucide-react";

interface Props {
  addToast: (msg: string, type: "success" | "error") => void;
}

interface FormState {
  name: string;
  description: string;
  base_price_cents: number;
  category: string;
  options: MenuItemOption[];
  imageFile: File | null;
  imagePreview: string | null;
  removeImage: boolean;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  base_price_cents: 500,
  category: DEFAULT_CATEGORY,
  options: [],
  imageFile: null,
  imagePreview: null,
  removeImage: false,
};

export default function MenuTab({ addToast }: Props) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [priceInput, setPriceInput] = useState("5.00");

  // In-store ordering toggle
  const [orderingEnabled, setOrderingEnabled] = useState(false);
  const [togglingOrdering, setTogglingOrdering] = useState(false);

  // New category input
  const [newCategory, setNewCategory] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAvailability, setFilterAvailability] = useState<string>("all");
  const [filterPriceRange, setFilterPriceRange] = useState<string>("all");
  const [filterOption, setFilterOption] = useState<string>("all");

  const [showFilters, setShowFilters] = useState(false);

  // Derived
  const categories = useMemo(() => deriveCategories(items), [items]);
  const allOptionNames = useMemo(() => {
    const names = new Set<string>();
    items.forEach((item) => item.options?.forEach((o) => names.add(o.name)));
    return Array.from(names).sort();
  }, [items]);
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterAvailability !== "all") c++;
    if (filterPriceRange !== "all") c++;
    if (filterOption !== "all") c++;
    return c;
  }, [filterAvailability, filterPriceRange, filterOption]);

  const loadMenu = () => {
    setLoading(true);
    fetchMenu()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMenu();
    fetchPublicConfig()
      .then((c) => setOrderingEnabled(c.in_store_ordering_enabled))
      .catch(() => {});
  }, []);

  const handleToggleOrdering = async () => {
    setTogglingOrdering(true);
    try {
      const res = await updateConfig({ in_store_ordering_enabled: !orderingEnabled });
      setOrderingEnabled(res.in_store_ordering_enabled);
      addToast(`In-store ordering ${res.in_store_ordering_enabled ? "enabled" : "disabled"}`, "success");
    } catch {
      addToast("Failed to update", "error");
    } finally {
      setTogglingOrdering(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPriceInput("5.00");
    setNewCategory("");
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
      imageFile: null,
      imagePreview: item.has_image ? getMenuImageUrl(item.id) : null,
      removeImage: false,
    });
    setPriceInput((item.base_price_cents / 100).toFixed(2));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const resolvedCategory = form.category === "__new__" ? newCategory.trim().toLowerCase() : form.category;
    if (!resolvedCategory) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        category: resolvedCategory,
        base_price_cents: Math.round(parseFloat(priceInput) * 100) || 500,
        options: form.options.length > 0 ? form.options : undefined,
      };

      let itemId = editingId;
      if (editingId) {
        await manageMenuItem("PUT", { id: editingId, ...data });
      } else {
        const created = await manageMenuItem("POST", data);
        itemId = created.id;
      }

      // Handle image upload/removal
      if (form.removeImage && itemId) {
        await deleteMenuItemImage(itemId);
      } else if (form.imageFile && itemId) {
        const resized = await resizeImage(form.imageFile);
        await uploadMenuImage(itemId, resized);
      }

      addToast(editingId ? "Item updated" : "Item added", "success");
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

  // Apply filters then group
  const filteredItems = items.filter((item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
    }
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    if (filterAvailability === "available" && !item.is_available) return false;
    if (filterAvailability === "hidden" && item.is_available !== false) return false;
    if (filterPriceRange !== "all") {
      const p = item.base_price_cents;
      if (filterPriceRange === "under3" && p >= 300) return false;
      if (filterPriceRange === "3to5" && (p < 300 || p > 500)) return false;
      if (filterPriceRange === "5to8" && (p < 500 || p > 800)) return false;
      if (filterPriceRange === "over8" && p <= 800) return false;
    }
    if (filterOption !== "all") {
      if (!item.options?.some((o) => o.name === filterOption)) return false;
    }
    return true;
  });

  const grouped = categories.map((cat) => ({
    category: cat,
    label: categoryLabel(cat),
    items: filteredItems.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl font-black text-stone-800 dark:text-stone-200">
          Menu Items
        </h2>
        <div className="flex items-center gap-3">
          {/* In-Store Ordering Toggle */}
          <button
            onClick={handleToggleOrdering}
            disabled={togglingOrdering}
            className="flex items-center gap-2 text-sm font-bold text-stone-600 dark:text-stone-400"
          >
            <span className="hidden sm:inline">In-Store Ordering</span>
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${
                orderingEnabled ? "bg-brand-olive" : "bg-stone-300 dark:bg-stone-600"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  orderingEnabled ? "translate-x-5" : ""
                }`}
              />
            </div>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-brand-olive text-white text-sm font-bold shadow hover:shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilterCount > 0 || showFilters
              ? "bg-brand-olive text-white shadow"
              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 bg-white text-brand-olive rounded-full text-[10px] font-black flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
      <div className="flex gap-1 flex-wrap mb-2">
        {["all", ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              filterCategory === cat
                ? "bg-brand-olive text-white shadow"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
            }`}
          >
            {cat === "all" ? "All" : categoryLabel(cat)}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-2"
          >
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/50 dark:border-stone-700/50 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">Availability</label>
                <div className="flex gap-1">
                  {(["all", "available", "hidden"] as const).map((av) => (
                    <button
                      key={av}
                      onClick={() => setFilterAvailability(av)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        filterAvailability === av
                          ? "bg-brand-olive text-white shadow"
                          : "bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-400"
                      }`}
                    >
                      {av === "all" ? "All" : av === "available" ? "Available" : "Hidden"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">Price</label>
                <div className="flex gap-1 flex-wrap">
                  {([["all", "All"], ["under3", "Under $3"], ["3to5", "$3–$5"], ["5to8", "$5–$8"], ["over8", "$8+"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setFilterPriceRange(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        filterPriceRange === val
                          ? "bg-brand-olive text-white shadow"
                          : "bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {allOptionNames.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">Options</label>
                  <div className="flex gap-1 flex-wrap">
                    {["all", ...allOptionNames].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setFilterOption(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filterOption === opt
                            ? "bg-brand-olive text-white shadow"
                            : "bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-400"
                        }`}
                      >
                        {opt === "all" ? "All" : opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setFilterAvailability("all"); setFilterPriceRange("all"); setFilterOption("all"); }}
                  className="text-xs font-bold text-red-500 hover:text-red-600"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  className={`p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/50 dark:border-stone-700/50 shadow-sm flex flex-col gap-2 ${
                    item.is_available === false ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {item.has_image && (
                      <img
                        src={getMenuImageUrl(item.id)}
                        alt=""
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
                        loading="lazy"
                      />
                    )}
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
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-brand-olive text-lg">
                        {formatPrice(item.base_price_cents)}
                      </span>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                  {item.options && item.options.length > 0 && (
                    <p className="text-xs text-stone-400 mt-0.5">
                      {item.options.map((o) => o.name).join(" · ")}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2">
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
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Description (can be multiple sentences)"
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive resize-y"
                  />
                </div>

                {/* Image */}
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                    Image
                  </label>
                  {form.imagePreview && !form.removeImage ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={form.imageFile ? URL.createObjectURL(form.imageFile) : form.imagePreview}
                        alt="Preview"
                        className="w-20 h-20 rounded-xl object-cover border border-stone-200 dark:border-stone-700"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, removeImage: true, imageFile: null, imagePreview: f.imagePreview }))}
                        className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600"
                      >
                        <ImageOff className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-dashed border-stone-300 dark:border-stone-600 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
                      <ImagePlus className="w-5 h-5 text-stone-400" />
                      <span className="text-sm text-stone-500">{form.removeImage ? "Add new image" : "Add image (optional)"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setForm((f) => ({
                              ...f,
                              imageFile: file,
                              imagePreview: URL.createObjectURL(file),
                              removeImage: false,
                            }));
                          }
                        }}
                      />
                    </label>
                  )}
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
                      onChange={(e) => {
                        setForm((f) => ({ ...f, category: e.target.value }));
                        if (e.target.value !== "__new__") setNewCategory("");
                      }}
                      className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {categoryLabel(cat)}
                        </option>
                      ))}
                      <option value="__new__">+ New category...</option>
                    </select>
                    {form.category === "__new__" && (
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="e.g. smoothies, pastries"
                        className="w-full mt-2 px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                      />
                    )}
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
