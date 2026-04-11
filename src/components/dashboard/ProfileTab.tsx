import { useState, useEffect, useRef } from "react";
import { Image, Trash2, Plus, RotateCcw, Save, Pencil, Video } from "lucide-react";
import {
  fetchSiteProfile,
  updateSiteProfile,
  uploadCarouselImage,
  deleteCarouselImageApi,
  getCarouselImageUrl,
  uploadLogoImage,
  deleteLogoImageApi,
  getLogoImageUrl,
  uploadWalkthroughVideo,
  deleteWalkthroughVideoApi,
  getWalkthroughVideoUrl,
} from "../../lib/api";
import { resizeImage } from "../../lib/image-utils";
import type { SiteProfile } from "../../lib/types";
import defaultLogo from "../../assets/logo.webp";

interface Props {
  addToast: (msg: string, type: "success" | "error") => void;
}

const DEFAULT_PROFILE: SiteProfile = {
  carousel_images: ["/bg1.webp", "/coffeebar.jpeg", "/bru.webp", "/dogtreats.jpeg", "/shop.webp"],
  address_text: "410 W 1st St #104, Tempe, AZ 85281",
  address_link: "https://maps.app.goo.gl/Ztxx4ZxxPG5SRg33A",
  address_enabled: true,
  google_url: "https://share.google/ywUaCuyd8boFskL5d",
  google_enabled: true,
  instagram_url: "https://www.instagram.com/bonesandbru?igsh=NWY3Znc0OTZ4cmty",
  instagram_enabled: true,
  facebook_url: "https://www.facebook.com/share/14WviUCEUSy/",
  facebook_enabled: true,
  tiktok_url: "https://www.tiktok.com/@bonesandbru",
  tiktok_enabled: true,
  owner_names: "John | Charity | Bru",
  phone: "7605096910",
  email: "johngagne@bonesandbru.com",
  contact_enabled: true,
  shop_url: "https://bonesandbru.com/",
  shop_text: "Visit Bonesandbru.com",
  shop_enabled: true,
  walkthrough_enabled: true,
  review_page_url: "https://g.page/r/CUGEACVcA-PbEAE/review",
  review_page_enabled: true,
};

function resolveImageSrc(src: string) {
  return src.startsWith("carousel:") ? getCarouselImageUrl(src.slice(9)) : src;
}

export default function ProfileTab({ addToast }: Props) {
  const [saved, setSaved] = useState<SiteProfile>(DEFAULT_PROFILE);
  const [draft, setDraft] = useState<SiteProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hasCustomLogo, setHasCustomLogo] = useState(false);
  const [hasCustomVideo, setHasCustomVideo] = useState(false);
  const carouselInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSiteProfile()
      .then((p) => { setSaved(p); setDraft(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch(getLogoImageUrl(), { method: "HEAD" })
      .then((r) => setHasCustomLogo(r.ok))
      .catch(() => setHasCustomLogo(false));
    fetch(getWalkthroughVideoUrl(), { method: "HEAD" })
      .then((r) => setHasCustomVideo(r.ok))
      .catch(() => setHasCustomVideo(false));
  }, []);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // Track blob IDs uploaded this session so we can clean up on cancel
  const pendingUploads = useRef<string[]>([]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateSiteProfile(draft);
      // Delete orphaned carousel blobs (were in saved but removed from draft)
      const removedSrcs = saved.carousel_images.filter((s) => !draft.carousel_images.includes(s));
      for (const src of removedSrcs) {
        if (src.startsWith("carousel:")) {
          try { await deleteCarouselImageApi(src.slice(9)); } catch {}
        }
      }
      pendingUploads.current = [];
      setSaved(updated);
      setDraft(updated);
      setEditing(false);
      addToast("Profile saved", "success");
    } catch {
      addToast("Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    // Clean up any carousel blobs uploaded this session that aren't in saved
    for (const id of pendingUploads.current) {
      if (!saved.carousel_images.includes(`carousel:${id}`)) {
        try { await deleteCarouselImageApi(id); } catch {}
      }
    }
    pendingUploads.current = [];
    setDraft(saved);
    setEditing(false);
  };

  const update = <K extends keyof SiteProfile>(key: K, value: SiteProfile[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleCarouselUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file);
      const id = crypto.randomUUID().slice(0, 8);
      await uploadCarouselImage(id, resized);
      pendingUploads.current.push(id);
      const src = `carousel:${id}`;
      update("carousel_images", [...draft.carousel_images, src]);
      addToast("Image staged — click Save to publish", "success");
    } catch {
      addToast("Failed to upload image", "error");
    }
    if (carouselInput.current) carouselInput.current.value = "";
  };

  const handleRemoveCarousel = (idx: number) => {
    update("carousel_images", draft.carousel_images.filter((_, i) => i !== idx));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file);
      await uploadLogoImage(resized);
      setHasCustomLogo(true);
      addToast("Logo updated", "success");
    } catch {
      addToast("Failed to upload logo", "error");
    }
    if (logoInput.current) logoInput.current.value = "";
  };

  const handleResetLogo = async () => {
    if (!window.confirm("Reset logo to default?")) return;
    try {
      await deleteLogoImageApi();
      setHasCustomLogo(false);
      addToast("Logo reset to default", "success");
    } catch {
      addToast("Failed to reset logo", "error");
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadWalkthroughVideo(file);
      setHasCustomVideo(true);
      addToast("Video uploaded", "success");
    } catch {
      addToast("Failed to upload video", "error");
    }
    if (videoInput.current) videoInput.current.value = "";
  };

  const handleResetVideo = async () => {
    if (!window.confirm("Reset video to default?")) return;
    try {
      await deleteWalkthroughVideoApi();
      setHasCustomVideo(false);
      addToast("Video reset to default", "success");
    } catch {
      addToast("Failed to reset video", "error");
    }
  };

  const logoSrc = hasCustomLogo ? `${getLogoImageUrl()}?t=${Date.now()}` : defaultLogo;

  if (loading) return <div className="text-center py-12 text-stone-400">Loading profile...</div>;

  return (
    <div className="space-y-6 min-w-0 overflow-hidden">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-black text-stone-800 dark:text-stone-200">
          Site Profile
        </h2>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl font-bold text-sm bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-brand-olive text-white shadow-md hover:shadow-lg"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Logo */}
      <Section title="Logo">
        <div className="flex items-center gap-4">
          <img
            src={logoSrc}
            alt="Logo"
            className="w-20 h-20 rounded-full object-cover border-2 border-stone-200 dark:border-stone-700"
          />
          {editing && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => logoInput.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              >
                <Image className="w-3.5 h-3.5" />
                Upload New
              </button>
              {hasCustomLogo && (
                <button
                  onClick={handleResetLogo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Default
                </button>
              )}
            </div>
          )}
          <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
      </Section>

      {/* Carousel */}
      <Section title="Carousel Images">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {draft.carousel_images.map((src, idx) => (
            <div key={idx} className="relative group aspect-video rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700">
              <img
                src={resolveImageSrc(src)}
                alt={`Slide ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {editing && (
                <button
                  onClick={() => handleRemoveCarousel(idx)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <span className="absolute bottom-0.5 left-1 text-[9px] font-bold text-white bg-black/50 px-1 rounded">
                {idx + 1}
              </span>
            </div>
          ))}
          {editing && (
            <button
              onClick={() => carouselInput.current?.click()}
              className="aspect-video rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 flex items-center justify-center text-stone-400 hover:border-brand-olive hover:text-brand-olive transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
        <input ref={carouselInput} type="file" accept="image/*" className="hidden" onChange={handleCarouselUpload} />
      </Section>

      {/* Walkthrough Video */}
      <Section title="Walkthrough Video">
        <Toggle checked={draft.walkthrough_enabled} onChange={(v) => update("walkthrough_enabled", v)} disabled={!editing} label="Show on site" />
        <div className="flex items-center gap-3">
          {editing && (
            <>
              <button
                onClick={() => videoInput.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              >
                <Video className="w-3.5 h-3.5" />
                Replace
              </button>
              {hasCustomVideo && (
                <button
                  onClick={handleResetVideo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Default
                </button>
              )}
            </>
          )}
          <span className="text-xs text-stone-400 italic">
            {hasCustomVideo ? "custom-upload.mp4" : "video.mp4 (default)"}
          </span>
        </div>
        <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
      </Section>

      {/* Address */}
      <Section title="Address">
        <Toggle checked={draft.address_enabled} onChange={(v) => update("address_enabled", v)} disabled={!editing} label="Show on site" />
        {editing && (
          <>
            <Input label="Address text" value={draft.address_text} onChange={(v) => update("address_text", v)} />
            <Input label="Map link" value={draft.address_link} onChange={(v) => update("address_link", v)} />
          </>
        )}
        {!editing && <p className="text-sm text-stone-600 dark:text-stone-400">{draft.address_text}</p>}
      </Section>

      {/* Social Links */}
      <Section title="Social Links">
        <SocialRow label="Google Reviews" enabled={draft.google_enabled} url={draft.google_url}
          onToggle={(v) => update("google_enabled", v)} onUrl={(v) => update("google_url", v)} editing={editing} />
        <SocialRow label="Instagram" enabled={draft.instagram_enabled} url={draft.instagram_url}
          onToggle={(v) => update("instagram_enabled", v)} onUrl={(v) => update("instagram_url", v)} editing={editing} />
        <SocialRow label="Facebook" enabled={draft.facebook_enabled} url={draft.facebook_url}
          onToggle={(v) => update("facebook_enabled", v)} onUrl={(v) => update("facebook_url", v)} editing={editing} />
        <SocialRow label="TikTok" enabled={draft.tiktok_enabled} url={draft.tiktok_url}
          onToggle={(v) => update("tiktok_enabled", v)} onUrl={(v) => update("tiktok_url", v)} editing={editing} />
      </Section>

      {/* Contact Info */}
      <Section title="Contact Info">
        <Toggle checked={draft.contact_enabled} onChange={(v) => update("contact_enabled", v)} disabled={!editing} label="Show on site" />
        {editing ? (
          <>
            <Input label="Owner names (use | separator)" value={draft.owner_names} onChange={(v) => update("owner_names", v)} />
            <Input label="Phone" value={draft.phone} onChange={(v) => update("phone", v)} />
            <Input label="Email" value={draft.email} onChange={(v) => update("email", v)} />
          </>
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-400">{draft.owner_names} &middot; {draft.phone} &middot; {draft.email}</p>
        )}
      </Section>

      {/* Shop Link */}
      <Section title="Shop Link">
        <Toggle checked={draft.shop_enabled} onChange={(v) => update("shop_enabled", v)} disabled={!editing} label="Show on site" />
        {editing ? (
          <>
            <Input label="Display text" value={draft.shop_text} onChange={(v) => update("shop_text", v)} />
            <Input label="URL" value={draft.shop_url} onChange={(v) => update("shop_url", v)} />
          </>
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-400">{draft.shop_text} &rarr; {draft.shop_url}</p>
        )}
      </Section>

      {/* Google Reviews Page */}
      <Section title="Google Reviews Page">
        <Toggle checked={draft.review_page_enabled} onChange={(v) => update("review_page_enabled", v)} disabled={!editing} label="Show on site" />
        {editing && (
          <Input label="Review page URL" value={draft.review_page_url} onChange={(v) => update("review_page_url", v)} />
        )}
        {!editing && <p className="text-sm text-stone-600 dark:text-stone-400 truncate">{draft.review_page_url}</p>}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-300 dark:border-stone-700 p-4 space-y-3 min-w-0 overflow-hidden">
      <h3 className="font-bold text-xs text-stone-500 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded accent-brand-olive"
      />
      <span className="text-sm text-stone-600 dark:text-stone-400">{label}</span>
    </label>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-0.5 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
      />
    </div>
  );
}

function SocialRow({ label, enabled, url, onToggle, onUrl, editing }: {
  label: string; enabled: boolean; url: string;
  onToggle: (v: boolean) => void; onUrl: (v: string) => void; editing: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
        disabled={!editing}
        className={`w-4 h-4 rounded accent-brand-olive shrink-0 ${!editing ? "opacity-60" : ""}`}
      />
      <span className="text-xs font-bold text-stone-600 dark:text-stone-400 w-20 shrink-0">{label}</span>
      {editing ? (
        <input
          type="text"
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          className="min-w-0 flex-1 px-2 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
        />
      ) : (
        <span className="text-xs text-stone-400 truncate min-w-0 flex-1">{enabled ? "Enabled" : "Hidden"}</span>
      )}
    </div>
  );
}
