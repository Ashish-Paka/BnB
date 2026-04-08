import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Edit3, Trash2, Eye, EyeOff, X, Search, SlidersHorizontal,
  ChevronUp, ChevronDown, GripVertical, RotateCcw, Pencil, Lock,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
// CSS import from @dnd-kit/utilities not used — we use a custom toTransformString to avoid scale distortion
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  fetchMenu, manageMenuItem, fetchPublicConfig, updateConfig,
  uploadMenuImage, deleteMenuItemImage, getMenuImageUrl,
  reorderMenuItems, fetchMenuOrdering, fetchPublishedMenu, fetchPublishedMenuOrdering, updateMenuOrdering,
  publishMenuDraft, fetchMenuPresets, updateMenuPresetTitle, activateMenuPreset,
  fetchMenuIncludeDeleted, restoreMenuItem, permanentlyDeleteMenuItem,
} from "../../lib/api";
import { resizeImage } from "../../lib/image-utils";
import type { MenuItem, MenuItemOption, MenuOrdering, MenuPresetState } from "../../lib/types";
import {
  DEFAULT_CATEGORY,
  deriveCategories,
  deriveCategoryLayout,
  deriveSubcategories,
  categoryLabel,
} from "../../lib/constants";
import { ImagePlus, ImageOff } from "lucide-react";

// ─── Props & Form Types ──────────────────────────────────────────────

interface Props {
  addToast: (msg: string, type: "success" | "error") => void;
}

interface FormState {
  name: string;
  description: string;
  base_price_cents: number;
  category: string;
  subcategory: string;
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
  subcategory: "",
  options: [],
  imageFile: null,
  imagePreview: null,
  removeImage: false,
};

// ─── Sortable Wrappers ──────────────────────────────────────────────

// Strip scaleX/scaleY from transform to prevent stretching during drag
function toTransformString(transform: { x: number; y: number; scaleX: number; scaleY: number } | null) {
  if (!transform) return undefined;
  return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`;
}

function SortableCategorySection({
  id,
  children,
  label,
  disabled,
  collapsed,
  onToggleCollapse,
}: {
  id: string;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: toTransformString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`mb-8 ${isDragging ? "z-50 relative" : ""}`}>
      <div className="flex items-center gap-2.5 mb-3">
        {!disabled && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab active:cursor-grabbing w-8 h-8 rounded-lg bg-brand-olive/10 dark:bg-brand-olive/20 hover:bg-brand-olive/20 dark:hover:bg-brand-olive/30 text-brand-olive flex items-center justify-center shrink-0 transition-colors"
            title="Drag to reorder category"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 group"
        >
          <h3 className="font-bold text-brand-olive text-base uppercase tracking-wider transition-colors">
            {label}
          </h3>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-brand-olive/60" />
          ) : (
            <ChevronUp className="w-4 h-4 text-brand-olive/60" />
          )}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`overflow-hidden ${isDragging ? "opacity-50 rounded-2xl ring-2 ring-brand-olive/30 p-1" : ""}`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SortableSubcategorySection({
  id,
  children,
  label,
  disabled,
  collapsed,
  onToggleCollapse,
}: {
  id: string;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: toTransformString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`mb-4 ${isDragging ? "z-50 relative" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        {!disabled && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab active:cursor-grabbing w-7 h-7 rounded-md bg-brand-olive/10 dark:bg-brand-olive/20 hover:bg-brand-olive/20 dark:hover:bg-brand-olive/30 text-brand-olive flex items-center justify-center shrink-0 transition-colors"
            title="Drag to reorder subcategory"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-1.5 group"
        >
          <h4 className="text-sm font-bold text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-300 uppercase tracking-wider transition-colors">
            {label}
          </h4>
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
          )}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`overflow-hidden ${isDragging ? "opacity-50" : ""}`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SortableItemCard({
  id,
  children,
  disabled,
}: {
  id: string;
  children: (props: {
    dragHandleRef: React.Ref<HTMLButtonElement>;
    dragHandleProps: Record<string, any>;
    isDragging: boolean;
  }) => React.ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: toTransformString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "z-50 relative" : ""}
    >
      {children({
        dragHandleRef: setActivatorNodeRef,
        dragHandleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function MenuTab({ addToast }: Props) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [priceInput, setPriceInput] = useState("5.00");

  // Edit mode — when off, drag handles hidden + action buttons greyed out
  const [editMode, setEditMode] = useState(false);
  const [syncingEditMode, setSyncingEditMode] = useState(false);

  // In-store ordering toggle
  const [orderingEnabled, setOrderingEnabled] = useState(false);
  const [togglingOrdering, setTogglingOrdering] = useState(false);
  const [presetState, setPresetState] = useState<MenuPresetState>({
    active_preset_index: 0,
    presets: Array.from({ length: 5 }, (_, index) => ({
      index,
      title: "",
      label: `Menu ${index}`,
    })),
  });
  const [presetTitleInput, setPresetTitleInput] = useState("");
  const [savingPresetTitle, setSavingPresetTitle] = useState(false);
  const [switchingPreset, setSwitchingPreset] = useState(false);
  const [showPresetNaming, setShowPresetNaming] = useState(false);

  // New category/subcategory input
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");

  // Ordering data
  const [ordering, setOrdering] = useState<MenuOrdering>({ category_order: [], subcategory_order: {} });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAvailability, setFilterAvailability] = useState<string>("all");
  const [filterPriceRange, setFilterPriceRange] = useState<string>("all");
  const [filterOption, setFilterOption] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Collapse state
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Set<string>>(new Set());

  const toggleCategoryCollapse = useCallback((cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const toggleSubcategoryCollapse = useCallback((key: string) => {
    setCollapsedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Deleted items
  const [deletedItems, setDeletedItems] = useState<MenuItem[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);

  // ─── DnD Sensors ────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Derived State ──────────────────────────────────────────────

  const categories = useMemo(() => deriveCategories(items, ordering.category_order), [items, ordering]);
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
  const hasActiveFilters = searchQuery || filterAvailability !== "all" || filterPriceRange !== "all" || filterOption !== "all";

  const getSubcategories = useCallback(
    (cat: string) => deriveSubcategories(items, cat, ordering.subcategory_order[cat]),
    [items, ordering]
  );

  const formSubcategories = useMemo(() => {
    const cat = form.category === "__new__" ? "" : form.category;
    if (!cat) return [];
    return deriveSubcategories(items, cat, ordering.subcategory_order[cat]).filter((s) => s !== "");
  }, [items, form.category, ordering]);

  const applyPresetState = useCallback((state: MenuPresetState) => {
    setPresetState(state);
    const activePreset = state.presets.find((preset) => preset.index === state.active_preset_index);
    setPresetTitleInput(activePreset?.title || "");
  }, []);

  const loadPresetState = useCallback(() => {
    fetchMenuPresets().then(applyPresetState).catch(() => {});
  }, [applyPresetState]);

  // ─── Data Loading ───────────────────────────────────────────────

  const loadMenu = useCallback((editingSnapshot = editMode) => {
    setLoading(true);
    Promise.all([
      editingSnapshot ? fetchMenu() : fetchPublishedMenu(),
      editingSnapshot ? fetchMenuOrdering() : fetchPublishedMenuOrdering(),
    ])
      .then(([nextItems, nextOrdering]) => {
        setItems(nextItems);
        setOrdering(nextOrdering);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [editMode]);

  useEffect(() => {
    loadPresetState();

    // Initial load always fetches everything
    fetchPublicConfig()
      .then((c) => {
        setOrderingEnabled(c.in_store_ordering_enabled);
        const nextEditMode = c.menu_editing_active ?? false;
        setEditMode(nextEditMode);
        return loadMenu(nextEditMode);
      })
      .catch(() => loadMenu());

    // Polling: only refresh config — skip menu reload to avoid resetting
    // scroll position and canceling in-progress drag operations.
    // Menu items only reload when edit mode actually transitions.
    const id = setInterval(() => {
      fetchPublicConfig()
        .then((c) => {
          setOrderingEnabled(c.in_store_ordering_enabled);
          const nextEditMode = c.menu_editing_active ?? false;
          setEditMode((prev) => {
            if (prev !== nextEditMode) {
              loadMenu(nextEditMode);
            }
            return nextEditMode;
          });
        })
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, [loadMenu, loadPresetState]);

  // Load deleted items when section is opened
  const loadDeletedItems = useCallback(() => {
    fetchMenuIncludeDeleted()
      .then((all) => setDeletedItems(all.filter((i) => i.deleted_at)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showDeleted) loadDeletedItems();
  }, [showDeleted, loadDeletedItems]);

  // ─── CRUD Handlers ──────────────────────────────────────────────

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

  const handleSavePresetTitle = async () => {
    setSavingPresetTitle(true);
    try {
      const next = await updateMenuPresetTitle(presetState.active_preset_index, presetTitleInput);
      applyPresetState(next);
      setShowPresetNaming(false);
      addToast("Preset title updated", "success");
    } catch {
      addToast("Failed to update preset title", "error");
    } finally {
      setSavingPresetTitle(false);
    }
  };

  const handleActivatePreset = async (index: number) => {
    if (index === presetState.active_preset_index) return;
    if (saving) {
      addToast("Finish saving the current item first", "error");
      return;
    }
    if (!editMode || syncingEditMode) {
      addToast("Enter edit mode before switching presets", "error");
      return;
    }

    setSwitchingPreset(true);
    try {
      const next = await activateMenuPreset(index, true);
      applyPresetState(next);
      setShowPresetNaming(false);
      setShowForm(false);
      setEditingId(null);
      void loadMenu(true);
      addToast(`Loaded ${next.presets.find((preset) => preset.index === index)?.label || `Menu ${index}`} into the draft menu`, "success");
    } catch {
      addToast("Failed to switch preset", "error");
    } finally {
      setSwitchingPreset(false);
    }
  };

  const enterEditMode = async (afterEnter?: () => void) => {
    if (saving || switchingPreset) return;
    if (editMode) {
      afterEnter?.();
      return;
    }

    setSyncingEditMode(true);
    try {
      await publishMenuDraft();
      const res = await updateConfig({ menu_editing_active: true });
      setEditMode(res.menu_editing_active);
      afterEnter?.();
    } catch {
      addToast("Failed to enter edit mode", "error");
    } finally {
      setSyncingEditMode(false);
    }
  };

  const exitEditMode = async () => {
    if (saving || switchingPreset) return;
    if (!editMode) return;

    setSyncingEditMode(true);
    try {
      await publishMenuDraft();
      const res = await updateConfig({ menu_editing_active: false });
      setEditMode(res.menu_editing_active);
      setShowForm(false);
      setEditingId(null);
      addToast("Menu changes published", "success");
    } catch {
      addToast("Failed to publish menu changes", "error");
    } finally {
      setSyncingEditMode(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPriceInput("5.00");
    setNewCategory("");
    setNewSubcategory("");
    setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      base_price_cents: item.base_price_cents,
      category: item.category,
      subcategory: item.subcategory || "",
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
    const resolvedSubcategory = form.subcategory === "__new__" ? newSubcategory.trim().toLowerCase() : form.subcategory;
    setSaving(true);
    try {
      const data = {
        name: form.name,
        description: form.description,
        category: resolvedCategory,
        subcategory: resolvedSubcategory || null,
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
      if (form.removeImage && itemId) {
        await deleteMenuItemImage(itemId);
      } else if (form.imageFile && itemId) {
        const resized = await resizeImage(form.imageFile);
        await uploadMenuImage(itemId, resized);
      }
      addToast(editingId ? "Item updated" : "Item added", "success");
      setShowForm(false);
      void loadMenu();
    } catch {
      addToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Delete "${item.name}"? It will be moved to the deleted items section.`)) return;
    try {
      await manageMenuItem("DELETE", { id: item.id });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      addToast("Item moved to deleted", "success");
      if (showDeleted) loadDeletedItems();
    } catch {
      addToast("Failed to delete", "error");
    }
  };

  const handleRestore = async (item: MenuItem) => {
    try {
      await restoreMenuItem(item.id);
      setDeletedItems((prev) => prev.filter((i) => i.id !== item.id));
      addToast(`"${item.name}" restored`, "success");
      void loadMenu();
    } catch {
      addToast("Failed to restore", "error");
    }
  };

  const handlePermanentDelete = async (item: MenuItem) => {
    if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return;
    if (!confirm(`Are you sure? "${item.name}" and its image will be gone forever.`)) return;
    try {
      await permanentlyDeleteMenuItem(item.id);
      setDeletedItems((prev) => prev.filter((i) => i.id !== item.id));
      addToast("Item permanently deleted", "success");
    } catch {
      addToast("Failed to delete", "error");
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await manageMenuItem("PUT", { id: item.id, is_available: !item.is_available });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i))
      );
      addToast(`${item.name} ${item.is_available ? "hidden" : "available"}`, "success");
    } catch {
      addToast("Failed to update", "error");
    }
  };

  // ─── Drag-and-Drop Handlers ─────────────────────────────────────

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.indexOf(active.id as string);
    const newIndex = categories.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove([...categories], oldIndex, newIndex);
    const newOrdering = { ...ordering, category_order: newOrder };
    setOrdering(newOrdering);

    updateMenuOrdering(newOrdering).catch(() => {
      addToast("Failed to reorder categories", "error");
      fetchMenuOrdering().then(setOrdering).catch(() => {});
    });
  };

  const handleItemDragEnd = (event: DragEndEvent, groupItems: MenuItem[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groupItems.findIndex((i) => i.id === active.id);
    const newIndex = groupItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove([...groupItems], oldIndex, newIndex);
    // Reassign sort_orders: keep the same set of values, just in new order
    const sortOrders = groupItems.map((i) => i.sort_order).sort((a, b) => a - b);
    const updates = reordered.map((item, idx) => ({
      id: item.id,
      sort_order: sortOrders[idx],
    }));

    // Optimistic update
    setItems((prev) => {
      const updateMap = new Map(updates.map((u) => [u.id, u.sort_order]));
      return prev.map((item) =>
        updateMap.has(item.id) ? { ...item, sort_order: updateMap.get(item.id)! } : item
      );
    });

    reorderMenuItems(updates).catch(() => {
      addToast("Failed to reorder", "error");
      void loadMenu();
    });
  };

  const handleCategoryLayoutDragEnd = (
    event: DragEndEvent,
    cat: string,
    layoutEntries: { id: string; token: string }[]
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = layoutEntries.findIndex((entry) => entry.id === active.id);
    const newIndex = layoutEntries.findIndex((entry) => entry.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove([...layoutEntries], oldIndex, newIndex).map((entry) => entry.token);
    const newOrdering = {
      ...ordering,
      subcategory_order: {
        ...ordering.subcategory_order,
        [cat]: newOrder,
      },
    };
    setOrdering(newOrdering);

    updateMenuOrdering(newOrdering).catch(() => {
      addToast("Failed to reorder category layout", "error");
      fetchMenuOrdering().then(setOrdering).catch(() => {});
    });
  };

  // ─── Option Management ──────────────────────────────────────────

  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, { name: "", choices: [{ label: "", extra_cents: 0 }], min_selections: 1, max_selections: 1, show_requirement_label: false }],
    }));
  };
  const removeOption = (idx: number) => {
    setForm((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  };
  const updateOptionName = (idx: number, name: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? { ...o, name } : o)),
    }));
  };
  const updateOptionField = (idx: number, field: string, value: number | boolean) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? { ...o, [field]: value } : o)),
    }));
  };
  const addChoice = (optIdx: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) =>
        i === optIdx ? { ...o, choices: [...o.choices, { label: "", extra_cents: 0 }] } : o
      ),
    }));
  };
  const removeChoice = (optIdx: number, choiceIdx: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) =>
        i === optIdx ? { ...o, choices: o.choices.filter((_, j) => j !== choiceIdx) } : o
      ),
    }));
  };
  const updateChoice = (optIdx: number, choiceIdx: number, field: "label" | "extra_cents", value: string | number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) =>
        i === optIdx
          ? { ...o, choices: o.choices.map((c, j) => (j === choiceIdx ? { ...c, [field]: value } : c)) }
          : o
      ),
    }));
  };

  // ─── Helpers ────────────────────────────────────────────────────

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

  // ─── Filter + Group Items ───────────────────────────────────────

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

  const sortedFiltered = [...filteredItems].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const grouped = categories
    .map((cat) => {
      const catItems = sortedFiltered.filter((i) => i.category === cat);
      if (catItems.length === 0) return null;
      const layoutEntries = deriveCategoryLayout(catItems, cat, ordering.subcategory_order[cat]);
      return { category: cat, label: categoryLabel(cat), layoutEntries, allItems: catItems };
    })
    .filter(Boolean) as {
      category: string;
      label: string;
      layoutEntries: ReturnType<typeof deriveCategoryLayout<MenuItem>>;
      allItems: MenuItem[];
    }[];

  // Can we reorder? Requires edit mode + no search/advanced filters
  const canReorderCategories = editMode && filterCategory === "all" && !hasActiveFilters;
  const canReorderItems = editMode && !hasActiveFilters;

  // ─── Item Card Renderer ─────────────────────────────────────────

  const renderItemContent = (
    item: MenuItem,
    dragHandleRef?: React.Ref<HTMLButtonElement>,
    dragHandleProps?: Record<string, any>,
    isDragging?: boolean
  ) => (
    <div
      className={`rounded-2xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-sm overflow-hidden flex transition-shadow ${
        item.is_available === false ? "opacity-50" : ""
      } ${isDragging ? "shadow-lg ring-2 ring-brand-olive/40" : ""}`}
    >
      {/* Drag handle — full-height colored strip on the left edge */}
      {canReorderItems && dragHandleRef && (
        <button
          ref={dragHandleRef}
          {...dragHandleProps}
          className="touch-none cursor-grab active:cursor-grabbing shrink-0 w-9 flex items-center justify-center bg-brand-olive/[0.07] dark:bg-brand-olive/15 hover:bg-brand-olive/15 dark:hover:bg-brand-olive/25 text-brand-olive transition-colors border-r border-brand-olive/10 dark:border-brand-olive/20"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      {/* Card content */}
      <div className="flex-1 min-w-0 p-4 flex flex-col gap-2">
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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-stone-800 dark:text-stone-200">{item.name}</p>
              {item.is_available === false && (
                <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                  Hidden
                </span>
              )}
              {item.subcategory && (
                <span className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 px-2 py-0.5 rounded-full font-medium">
                  {categoryLabel(item.subcategory)}
                </span>
              )}
            </div>
          </div>
          <span className="font-bold text-brand-olive text-lg shrink-0">{formatPrice(item.base_price_cents)}</span>
        </div>
        {item.description && (
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{item.description}</p>
        )}
        {item.options && item.options.length > 0 && (
          <p className="text-xs text-stone-400 mt-0.5">{item.options.map((o) => o.name).join(" · ")}</p>
        )}
        <div className={`flex items-center justify-end gap-2 ${!editMode ? "opacity-30 pointer-events-none" : ""}`}>
          <button
            onClick={() => handleToggleAvailability(item)}
            disabled={!editMode}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 transition-colors"
            title={item.is_available === false ? "Make available" : "Hide item"}
          >
            {item.is_available === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => openEdit(item)}
            disabled={!editMode}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(item)}
            disabled={!editMode}
            className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Subcategory + Items Section ────────────────────────────────

  // Render items within a group (with or without DnD)
  const renderItemList = (groupItems: MenuItem[]) =>
    canReorderItems ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={(e) => handleItemDragEnd(e, groupItems)}
      >
        <SortableContext items={groupItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-3">
            {groupItems.map((item) => (
              <SortableItemCard key={item.id} id={item.id}>
                {({ dragHandleRef, dragHandleProps, isDragging }) =>
                  renderItemContent(item, dragHandleRef, dragHandleProps, isDragging)
                }
              </SortableItemCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    ) : (
      <div className="grid gap-3">
        {groupItems.map((item) => (
          <div key={item.id}>{renderItemContent(item)}</div>
        ))}
      </div>
    );

  // ─── Category Content ───────────────────────────────────────────

  const renderCategoryContent = (group: (typeof grouped)[number]) => {
    const hasNamedSubcats = group.layoutEntries.some((entry) => entry.kind === "subcategory");
    const layoutIds = group.layoutEntries.map((entry) => entry.id);

    // If there's only one group and it has no subcategory, just render items directly
    if (!hasNamedSubcats) {
      return renderItemList(group.allItems);
    }

    const renderLayoutEntries = () =>
      group.layoutEntries.map((entry) => {
        if (entry.kind === "item") {
          const itemBlock = canReorderItems ? (
            <SortableItemCard key={entry.id} id={entry.id}>
              {({ dragHandleRef, dragHandleProps, isDragging }) =>
                renderItemContent(entry.item, dragHandleRef, dragHandleProps, isDragging)
              }
            </SortableItemCard>
          ) : (
            <div key={entry.id}>{renderItemContent(entry.item)}</div>
          );

          return (
            <div key={entry.id} className="mb-3">
              {itemBlock}
            </div>
          );
        }

        const subKey = `${group.category}::${entry.subcategory}`;
        const id = entry.id;

        // Items block (used inside both named and unnamed subcategories)
        const itemsBlock = renderItemList(entry.items);

        // Named subcategory — indented block with different shade
        const inner = (
          <div className="ml-3 pl-3 border-l-2 border-brand-olive/20 dark:border-brand-olive/15 rounded-bl-lg">
            <div className="p-2 rounded-xl bg-stone-50/80 dark:bg-stone-800/40">
              {itemsBlock}
            </div>
          </div>
        );

        // Sortable subcategory wrapper (when DnD is active)
        if (canReorderItems && hasNamedSubcats) {
          return (
            <SortableSubcategorySection
              key={id}
              id={id}
              label={categoryLabel(entry.subcategory)}
              collapsed={collapsedSubcategories.has(subKey)}
              onToggleCollapse={() => toggleSubcategoryCollapse(subKey)}
            >
              {inner}
            </SortableSubcategorySection>
          );
        }

        // Fallback: collapsible but no drag
        return (
          <div key={id} className="mb-4">
            <button
              onClick={() => toggleSubcategoryCollapse(subKey)}
              className="flex items-center gap-1.5 mb-2 ml-1 group"
            >
              <h4 className="text-sm font-bold text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-300 uppercase tracking-wider transition-colors">
                {categoryLabel(entry.subcategory)}
              </h4>
              {collapsedSubcategories.has(subKey) ? (
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
              )}
            </button>
            <AnimatePresence initial={false}>
              {!collapsedSubcategories.has(subKey) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {inner}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      });

    // Wrap in subcategory DnD context when reordering is possible
    if (canReorderItems && hasNamedSubcats) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={(e) => handleCategoryLayoutDragEnd(e, group.category, group.layoutEntries)}
        >
          <SortableContext items={layoutIds} strategy={verticalListSortingStrategy}>
            {renderLayoutEntries()}
          </SortableContext>
        </DndContext>
      );
    }

    return <>{renderLayoutEntries()}</>;
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h2 className="font-serif text-xl font-black text-stone-800 dark:text-stone-200">Menu Items</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleToggleOrdering}
            disabled={togglingOrdering}
            className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wide"
          >
            <span className={`transition-colors ${
              orderingEnabled
                ? "text-green-700 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {orderingEnabled ? "Online" : "Offline"}
            </span>
            <div
              className={`relative w-11 h-6 rounded-full transition-colors border ${
                orderingEnabled
                  ? "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700"
                  : "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-all ${
                  orderingEnabled
                    ? "translate-x-5 bg-green-500"
                    : "bg-red-500"
                }`}
              />
            </div>
          </button>
          <button
            onClick={() => {
              if (syncingEditMode || saving || switchingPreset) return;
              if (editMode) {
                void exitEditMode();
              } else {
                void enterEditMode();
              }
            }}
            disabled={syncingEditMode || saving || switchingPreset}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
              editMode
                ? "bg-brand-orange text-white shadow"
                : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700"
            }`}
          >
            {editMode ? <Pencil className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {saving ? "Saving item..." : syncingEditMode ? "Saving..." : editMode ? "Editing" : "Edit"}
          </button>
          <button
            onClick={() => { void enterEditMode(openAdd); }}
            disabled={syncingEditMode || saving || switchingPreset}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-brand-olive text-white text-sm font-bold shadow hover:shadow-md transition-all"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {editMode && (
        <div className="mb-4 p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Menu Presets
            </h3>
            <span className="text-[11px] text-stone-400">
              Preset changes stay in draft until you leave edit mode
            </span>
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            {presetState.presets.map((preset) => (
              <button
                key={preset.index}
                onClick={() => { void handleActivatePreset(preset.index); }}
                disabled={switchingPreset || syncingEditMode || saving}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  preset.index === presetState.active_preset_index
                    ? "bg-brand-orange text-white shadow"
                    : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={() => setShowPresetNaming((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-medium text-stone-600 dark:text-stone-300"
            >
              <Edit3 className="w-4 h-4" />
              {showPresetNaming ? "Close title editor" : "Edit title"}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {showPresetNaming && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 flex-wrap pt-3">
                  <input
                    type="text"
                    value={presetTitleInput}
                    onChange={(e) => setPresetTitleInput(e.target.value)}
                    placeholder={`Title for Menu ${presetState.active_preset_index}`}
                    className="flex-1 min-w-[180px] px-4 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                  />
                  <button
                    onClick={() => { void handleSavePresetTitle(); }}
                    disabled={savingPresetTitle}
                    className="px-4 py-2 rounded-xl bg-brand-olive text-white text-sm font-bold shadow hover:shadow-md transition-all disabled:opacity-50"
                  >
                    {savingPresetTitle ? "Saving..." : "Save Title"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shadow-xs"
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

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap mb-2">
        {["all", ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              filterCategory === cat
                ? "bg-brand-olive text-white shadow"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shadow-xs"
            }`}
          >
            {cat === "all" ? "All" : categoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-2"
          >
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-300 dark:border-stone-700 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">
                  Availability
                </label>
                <div className="flex gap-1">
                  {(["all", "available", "hidden"] as const).map((av) => (
                    <button
                      key={av}
                      onClick={() => setFilterAvailability(av)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        filterAvailability === av
                          ? "bg-brand-olive text-white shadow"
                          : "bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shadow-xs"
                      }`}
                    >
                      {av === "all" ? "All" : av === "available" ? "Available" : "Hidden"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">
                  Price
                </label>
                <div className="flex gap-1 flex-wrap">
                  {([["all", "All"], ["under3", "Under $3"], ["3to5", "$3–$5"], ["5to8", "$5–$8"], ["over8", "$8+"]] as const).map(
                    ([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setFilterPriceRange(val)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filterPriceRange === val
                            ? "bg-brand-olive text-white shadow"
                            : "bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shadow-xs"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>
              {allOptionNames.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">
                    Options
                  </label>
                  <div className="flex gap-1 flex-wrap">
                    {["all", ...allOptionNames].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setFilterOption(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filterOption === opt
                            ? "bg-brand-olive text-white shadow"
                            : "bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shadow-xs"
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
                  onClick={() => {
                    setFilterAvailability("all");
                    setFilterPriceRange("all");
                    setFilterOption("all");
                  }}
                  className="text-xs font-bold text-red-500 hover:text-red-600"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu List */}
      {loading ? (
        <p className="text-center text-stone-400 py-12">Loading menu...</p>
      ) : canReorderCategories && grouped.length > 1 ? (
        /* Category-level drag enabled */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext items={grouped.map((g) => g.category)} strategy={verticalListSortingStrategy}>
            {grouped.map((group) => (
              <SortableCategorySection
                key={group.category}
                id={group.category}
                label={group.label}
                collapsed={collapsedCategories.has(group.category)}
                onToggleCollapse={() => toggleCategoryCollapse(group.category)}
              >
                {renderCategoryContent(group)}
              </SortableCategorySection>
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        /* Category drag disabled (filtered or single category) */
        grouped.map((group) => (
          <div key={group.category} className="mb-8">
            <button
              onClick={() => toggleCategoryCollapse(group.category)}
              className="flex items-center gap-2 mb-3 group"
            >
              <h3 className="font-bold text-brand-olive text-base uppercase tracking-wider transition-colors">
                {group.label}
              </h3>
              {collapsedCategories.has(group.category) ? (
                <ChevronDown className="w-4 h-4 text-brand-olive/60" />
              ) : (
                <ChevronUp className="w-4 h-4 text-brand-olive/60" />
              )}
            </button>
            <AnimatePresence initial={false}>
              {!collapsedCategories.has(group.category) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {renderCategoryContent(group)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))
      )}

      {/* Deleted Items Section */}
      <div className="mt-8 border-t border-stone-300 dark:border-stone-700 pt-4">
        <button
          onClick={() => setShowDeleted(!showDeleted)}
          className="flex items-center gap-2 text-sm font-bold text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors uppercase tracking-wider"
        >
          {showDeleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Deleted Items ({deletedItems.length})
        </button>
        <AnimatePresence>
          {showDeleted && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {deletedItems.length === 0 ? (
                <p className="text-center text-stone-400 py-6 text-sm">No deleted items</p>
              ) : (
                <div className="grid gap-2 mt-3">
                  {deletedItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200/30 dark:border-red-800/30 opacity-70"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.has_image && (
                            <img
                              src={getMenuImageUrl(item.id)}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                              loading="lazy"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-stone-600 dark:text-stone-400">
                              {item.name}
                            </p>
                            <p className="text-xs text-stone-400">
                              {categoryLabel(item.category)}
                              {item.subcategory && ` / ${categoryLabel(item.subcategory)}`}
                              {" · "}
                              {formatPrice(item.base_price_cents)}
                            </p>
                            <p className="text-xs text-red-400">
                              Deleted {new Date(item.deleted_at!).toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleRestore(item)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-olive/10 hover:bg-brand-olive text-brand-olive hover:text-white text-xs font-bold transition-all"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(item)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-600 text-red-600 hover:text-white text-xs font-bold transition-all dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
                        >
                          <Trash2 className="w-3 h-3" /> Delete Forever
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
              className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto bg-[var(--bg-color)] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-300 dark:border-stone-700"
            >
              <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2">
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

              <div className="px-4 sm:px-6 pb-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Latte"
                    className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Description (can be multiple sentences)"
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive resize-y"
                  />
                </div>

                {/* Image */}
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">Image</label>
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
                      <span className="text-sm text-stone-500">
                        {form.removeImage ? "Add new image" : "Add image (optional)"}
                      </span>
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
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">Price ($)</label>
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
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, category: e.target.value, subcategory: "" }));
                        if (e.target.value !== "__new__") setNewCategory("");
                      }}
                      className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{categoryLabel(cat)}</option>
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

                {/* Subcategory */}
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                    Subcategory <span className="text-stone-400 normal-case font-normal">(optional)</span>
                  </label>
                  <select
                    value={form.subcategory}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, subcategory: e.target.value }));
                      if (e.target.value !== "__new__") setNewSubcategory("");
                    }}
                    className="w-full px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                  >
                    <option value="">None</option>
                    {formSubcategories.map((sub) => (
                      <option key={sub} value={sub}>{categoryLabel(sub)}</option>
                    ))}
                    <option value="__new__">+ New subcategory...</option>
                  </select>
                  {form.subcategory === "__new__" && (
                    <input
                      type="text"
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                      placeholder="e.g. hot drinks, iced drinks"
                      className="w-full mt-2 px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                    />
                  )}
                </div>

                {/* Options */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Customization Options</label>
                    <button onClick={addOption} className="text-xs font-bold text-brand-olive hover:opacity-80">
                      + Add Option
                    </button>
                  </div>
                  {form.options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className="mb-3 p-2 sm:p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <input
                          type="text"
                          value={opt.name}
                          onChange={(e) => updateOptionName(optIdx, e.target.value)}
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
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-stone-400">Min</span>
                          <input
                            type="number"
                            min="0"
                            max={opt.choices.length}
                            value={opt.min_selections ?? 1}
                            onChange={(e) => updateOptionField(optIdx, "min_selections", Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-12 px-1.5 py-0.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 outline-none text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-stone-400">Max</span>
                          <input
                            type="number"
                            min="1"
                            max={opt.choices.length || 1}
                            value={opt.max_selections ?? 1}
                            onChange={(e) => updateOptionField(optIdx, "max_selections", Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-12 px-1.5 py-0.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 outline-none text-center"
                          />
                        </div>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={opt.show_requirement_label ?? false}
                            onChange={(e) => updateOptionField(optIdx, "show_requirement_label", e.target.checked)}
                            className="accent-brand-olive w-3 h-3"
                          />
                          <span className="text-[10px] text-stone-400">Show label</span>
                        </label>
                      </div>
                      {opt.choices.map((choice, choiceIdx) => (
                        <div key={choiceIdx} className="flex items-center gap-1.5 mb-1 min-w-0">
                          <input
                            type="text"
                            value={choice.label}
                            onChange={(e) => updateChoice(optIdx, choiceIdx, "label", e.target.value)}
                            placeholder="Label"
                            className="min-w-0 flex-1 px-2 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 outline-none"
                          />
                          <div className="flex items-center gap-0.5 shrink-0">
                            <span className="text-[10px] text-stone-400">+$</span>
                            <input
                              type="number"
                              step="0.50"
                              min="0"
                              value={(choice.extra_cents / 100).toFixed(2)}
                              onChange={(e) =>
                                updateChoice(optIdx, choiceIdx, "extra_cents", Math.round(parseFloat(e.target.value || "0") * 100))
                              }
                              className="w-14 px-1.5 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 outline-none"
                            />
                          </div>
                          <button onClick={() => removeChoice(optIdx, choiceIdx)} className="p-0.5 text-red-400 shrink-0">
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

                {/* Save */}
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="w-full py-3 rounded-xl bg-brand-olive text-white font-bold shadow-lg disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
