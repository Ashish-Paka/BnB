import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Trash2, Star, Shield, RefreshCw, KeyRound, Download, Upload, Clock, Cloud } from "lucide-react";
import {
  changePassword,
  fetchSettings,
  addGoogleAccount,
  removeGoogleAccount,
  setPrimaryAccount,
  replaceGoogleAccount,
  exportBackup,
  exportBackupOnline,
  importBackup,
  restoreLatestBackup,
} from "../../lib/api";
import {
  generateBackupZip,
  downloadBlob,
  formatBackupTimestamp,
  parseBackupFile,
  validateBackupJSON,
} from "../../lib/backup-utils";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

interface GoogleAccount {
  email: string;
  role: "primary" | "secondary" | "admin";
}

interface Props {
  addToast: (message: string, type: "success" | "error" | "info") => void;
  lastOnlineBackup: string | null;
  setLastOnlineBackup: (value: string | null) => void;
}

export default function SettingsTab({ addToast, lastOnlineBackup, setLastOnlineBackup }: Props) {
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // Admin password state
  const [adminCurrentPassword, setAdminCurrentPassword] = useState("");
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [showAdminCurrent, setShowAdminCurrent] = useState(false);
  const [showAdminNew, setShowAdminNew] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Google accounts
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([]);
  const [loginMethod, setLoginMethod] = useState<string>("password");
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [replacingEmail, setReplacingEmail] = useState<string | null>(null);
  const [addingRole, setAddingRole] = useState<"secondary" | "admin">("secondary");
  const googleAddRef = useRef<HTMLDivElement>(null);
  const googleReplaceRef = useRef<HTMLDivElement>(null);

  // Permission flags from server
  const [isOwner, setIsOwner] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [hasAdminPassword, setHasAdminPassword] = useState(false);

  const canChangeAccount = (accountEmail: string) => {
    if (isOwner || isAdminUser) return true;
    return loginMethod === accountEmail;
  };

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setGoogleAccounts(s.google_accounts);
        setLoginMethod(s.login_method);
        setIsOwner(s.is_owner);
        setIsAdminUser(s.is_admin);
        setCanChangePassword(s.can_change_password);
        setHasAdminPassword(s.has_admin_password);
      })
      .catch(() => {})
      .finally(() => setLoadingGoogle(false));
  }, []);

  // Initialize Google Sign-In button for adding accounts
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleAddRef.current || (!isOwner && !isAdminUser) || googleAccounts.length >= (isAdminUser ? 4 : 3)) return;

    const tryInit = () => {
      if (!window.google?.accounts?.id || !googleAddRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          try {
            const res = await addGoogleAccount(response.credential, addingRole);
            setGoogleAccounts(res.google_accounts);
            addToast("Google account added!", "success");
          } catch (err: any) {
            const msg = err?.message || "Failed to add account";
            try { addToast(JSON.parse(msg).error || msg, "error"); } catch { addToast(msg, "error"); }
          }
        },
      });
      window.google.accounts.id.renderButton(googleAddRef.current, {
        type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "pill",
      });
    };

    if (window.google?.accounts?.id) tryInit();
    else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(interval); tryInit(); }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [googleAccounts.length, isOwner, isAdminUser, addToast, addingRole]);

  // Initialize Google Sign-In button for replacing an account
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleReplaceRef.current || !replacingEmail) return;

    const tryInit = () => {
      if (!window.google?.accounts?.id || !googleReplaceRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          try {
            const res = await replaceGoogleAccount(response.credential, replacingEmail);
            setGoogleAccounts(res.google_accounts);
            setReplacingEmail(null);
            addToast("Google account updated!", "success");
          } catch (err: any) {
            const msg = err?.message || "Failed to replace account";
            try { addToast(JSON.parse(msg).error || msg, "error"); } catch { addToast(msg, "error"); }
          }
        },
      });
      window.google.accounts.id.renderButton(googleReplaceRef.current, {
        type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "pill",
      });
    };

    if (window.google?.accounts?.id) tryInit();
    else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(interval); tryInit(); }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [replacingEmail, addToast]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { addToast("Passwords do not match", "error"); return; }
    if (newPassword.length < 8) { addToast("Password must be at least 8 characters", "error"); return; }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword, "owner");
      addToast("Main password changed successfully", "success");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch { addToast("Failed to change password. Check your current password.", "error"); }
    finally { setSaving(false); }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminNewPassword !== adminConfirmPassword) { addToast("Passwords do not match", "error"); return; }
    if (adminNewPassword.length < 8) { addToast("Password must be at least 8 characters", "error"); return; }
    setSavingAdmin(true);
    try {
      await changePassword(adminCurrentPassword, adminNewPassword, "admin");
      addToast(hasAdminPassword ? "Admin password changed" : "Admin password set", "success");
      setAdminCurrentPassword(""); setAdminNewPassword(""); setAdminConfirmPassword("");
      setHasAdminPassword(true);
    } catch { addToast("Failed to change admin password.", "error"); }
    finally { setSavingAdmin(false); }
  };

  const handleRemove = async (email: string) => {
    try {
      const res = await removeGoogleAccount(email);
      setGoogleAccounts(res.google_accounts);
      addToast("Account removed", "success");
    } catch { addToast("Failed to remove account", "error"); }
  };

  const handleSetPrimary = async (email: string) => {
    try {
      const res = await setPrimaryAccount(email);
      setGoogleAccounts(res.google_accounts);
      addToast("Primary account updated", "success");
    } catch { addToast("Failed to update primary account", "error"); }
  };

  const hasAdminAccount = googleAccounts.some((a) => a.role === "admin");

  // Backup state
  const [onlineBackupLoading, setOnlineBackupLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [restoringLatest, setRestoringLatest] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ data: any; summary: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackupOnline = async () => {
    setOnlineBackupLoading(true);
    try {
      const data = await exportBackupOnline();
      setLastOnlineBackup(data.exported_at);
      addToast("Restore point created", "success");
    } catch {
      addToast("Failed to create restore point", "error");
    } finally {
      setOnlineBackupLoading(false);
    }
  };

  const handleRestoreLatest = async () => {
    if (!lastOnlineBackup) {
      addToast("No restore point available", "error");
      return;
    }
    if (!window.confirm("Restore all data from the latest restore point? This will overwrite the current app state.")) {
      return;
    }

    setRestoringLatest(true);
    try {
      const result = await restoreLatestBackup();
      addToast(`Restored latest restore point${result.restored_from ? ` from ${new Date(result.restored_from).toLocaleString()}` : ""}`, "success");
    } catch (err: any) {
      addToast(err?.message || "Failed to restore latest restore point", "error");
    } finally {
      setRestoringLatest(false);
    }
  };

  const handleDownloadBackup = async () => {
    setDownloadLoading(true);
    try {
      const data = await exportBackup();
      const ts = formatBackupTimestamp();
      const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(jsonBlob, `bnb-backup-${ts}.json`);
      const zipBlob = await generateBackupZip(data);
      downloadBlob(zipBlob, `bnb-backup-${ts}.zip`);
      addToast("Backup downloaded!", "success");
    } catch {
      addToast("Failed to download backup", "error");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    void parseBackupFile(file)
      .then((data) => {
        const { valid, errors } = validateBackupJSON(data);
        if (!valid) {
          addToast(`Invalid backup: ${errors.join(", ")}`, "error");
          return;
        }
        const summary = [
          data.menu?.length ? `${data.menu.length} menu items` : null,
          data.menu_presets?.presets?.length ? `${data.menu_presets.presets.length} menu presets` : null,
          data.customers?.length ? `${data.customers.length} customers` : null,
          data.orders?.length ? `${data.orders.length} orders` : null,
          data.visits?.length ? `${data.visits.length} visits` : null,
          data.config ? "config" : null,
          data.images ? `${Object.keys(data.images).length} images` : null,
          data.published_images ? `${Object.keys(data.published_images).length} published images` : null,
        ].filter(Boolean).join(", ");
        setPendingImport({ data, summary });
      })
      .catch((err: any) => {
        addToast(err?.message || "Invalid backup file", "error");
      });
  };

  const executeImport = async (mode: "overwrite" | "combine") => {
    if (!pendingImport) return;
    setImportLoading(true);
    try {
      const result = await importBackup(pendingImport.data, mode);
      const label = mode === "combine" ? "Merged" : "Imported";
      addToast(`${label}! ${JSON.stringify(result.imported)}`, "success");
    } catch (err: any) {
      addToast(err?.message || "Failed to import", "error");
    } finally {
      setImportLoading(false);
      setPendingImport(null);
    }
  };

  const roleBadge = (role: GoogleAccount["role"]) => {
    if (role === "primary") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-full">
          <Star className="w-3 h-3" /> Primary
        </span>
      );
    }
    if (role === "admin") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full">
          <KeyRound className="w-3 h-3" /> Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-400 bg-stone-100 dark:bg-stone-700 px-2 py-0.5 rounded-full">
        <Shield className="w-3 h-3" /> Secondary
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Main Password — owner and admin */}
      {(isOwner || isAdminUser) && (
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-sm">
          <h3 className="font-bold text-stone-800 dark:text-stone-200 mb-4">Main Password</h3>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <div className="relative">
              <input type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" required className="w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 8 chars)" required minLength={8} className="w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent" />
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-brand-orange text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50">
              {saving ? "Saving..." : "Change Main Password"}
            </button>
          </form>
        </div>
      )}

      {/* Admin Password — admin only */}
      {isAdminUser && (
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-sm">
          <h3 className="font-bold text-stone-800 dark:text-stone-200 mb-1">Admin Password</h3>
          <p className="text-xs text-stone-400 mb-4">Change your admin password</p>
          <form onSubmit={handleChangeAdminPassword} className="flex flex-col gap-3">
            <div className="relative">
              <input type={showAdminCurrent ? "text" : "password"} value={adminCurrentPassword} onChange={(e) => setAdminCurrentPassword(e.target.value)} placeholder="Current admin password" required className="w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              <button type="button" onClick={() => setShowAdminCurrent(!showAdminCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                {showAdminCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <input type={showAdminNew ? "text" : "password"} value={adminNewPassword} onChange={(e) => setAdminNewPassword(e.target.value)} placeholder="New admin password (min 8 chars)" required minLength={8} className="w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              <button type="button" onClick={() => setShowAdminNew(!showAdminNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                {showAdminNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input type="password" value={adminConfirmPassword} onChange={(e) => setAdminConfirmPassword(e.target.value)} placeholder="Confirm admin password" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            <button type="submit" disabled={savingAdmin} className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50">
              {savingAdmin ? "Saving..." : "Change Admin Password"}
            </button>
          </form>
        </div>
      )}

      {/* Google Accounts */}
      {GOOGLE_CLIENT_ID && (
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-sm">
          <h3 className="font-bold text-stone-800 dark:text-stone-200 mb-4">
            Google Accounts
            <span className="text-xs font-normal text-stone-400 ml-2">({googleAccounts.length}/{isAdminUser ? 4 : 3})</span>
          </h3>
          {loadingGoogle ? (
            <p className="text-sm text-stone-400">Loading...</p>
          ) : (
            <>
              {googleAccounts.length === 0 ? (
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">
                  No Google accounts linked. Add one to enable Google Sign-In.
                </p>
              ) : (
                <div className="flex flex-col gap-2 mb-4">
                  {googleAccounts.map((account) => (
                    <div key={account.email}>
                      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
                            {account.email}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {roleBadge(account.role)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canChangeAccount(account.email) && (
                            <button
                              onClick={() => setReplacingEmail(replacingEmail === account.email ? null : account.email)}
                              className={`p-1.5 rounded-lg transition-colors ${replacingEmail === account.email ? "bg-brand-olive/10 text-brand-olive" : "text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"}`}
                              title="Change Google account"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Management buttons — owner manages non-admin, admin manages all */}
                          {(isOwner || isAdminUser) && account.role !== "primary" && (
                            <>
                              {account.role === "secondary" && (
                                <button
                                  onClick={() => handleSetPrimary(account.email)}
                                  className="text-[10px] font-bold text-brand-orange hover:bg-brand-orange/10 px-2 py-1 rounded-lg transition-colors"
                                >
                                  Make Primary
                                </button>
                              )}
                              <button
                                onClick={() => handleRemove(account.email)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Inline replace Google button */}
                      {replacingEmail === account.email && (
                        <div className="mt-2 ml-3 p-2 rounded-lg bg-stone-100 dark:bg-stone-700/50">
                          <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
                            Sign in with the new Google account to replace this one:
                          </p>
                          <div ref={googleReplaceRef} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add account — owner or admin, respecting max */}
              {(isOwner || isAdminUser) && googleAccounts.length < (isAdminUser ? 4 : 3) && (
                <div>
                  <p className="text-xs text-stone-400 mb-2">
                    Add a Google account to allow dashboard access.
                  </p>
                  {/* Role selector — admin sees Secondary + Admin, owner sees Secondary only */}
                  {isAdminUser ? (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => setAddingRole("secondary")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${addingRole === "secondary" ? "bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-800" : "bg-stone-100 dark:bg-stone-700 text-stone-500"}`}
                      >
                        Secondary
                      </button>
                      {!hasAdminAccount && (
                        <button
                          onClick={() => setAddingRole("admin")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${addingRole === "admin" ? "bg-purple-600 text-white" : "bg-stone-100 dark:bg-stone-700 text-stone-500"}`}
                        >
                          Admin
                        </button>
                      )}
                    </div>
                  ) : null}
                  <div ref={googleAddRef} />
                </div>
              )}

              {!isOwner && !isAdminUser && loginMethod !== "password" && (
                <p className="text-xs text-stone-400 italic">
                  Only the primary account or admin can manage accounts and change passwords.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Backup — owner/primary/admin only */}
      {(isOwner || isAdminUser) && (
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-sm">
          <h3 className="font-bold text-stone-800 dark:text-stone-200 mb-1">Data Backup</h3>
          <p className="text-xs text-stone-400 mb-4">Menu drafts, published menu state, presets, images, customers, orders, visits, config, and account info.</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleBackupOnline}
              disabled={onlineBackupLoading}
              className="w-full py-3 rounded-xl bg-brand-olive text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Cloud className="w-4 h-4" />
              {onlineBackupLoading ? "Saving..." : "Create Restore Point"}
            </button>

            <button
              onClick={handleRestoreLatest}
              disabled={restoringLatest || !lastOnlineBackup}
              className="w-full py-3 rounded-xl bg-white dark:bg-stone-800 border-2 border-brand-olive text-brand-olive font-bold shadow hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${restoringLatest ? "animate-spin" : ""}`} />
              {restoringLatest ? "Restoring..." : "Restore From Latest Restore Point"}
            </button>

            <button
              onClick={handleDownloadBackup}
              disabled={downloadLoading}
              className="w-full py-3 rounded-xl bg-white dark:bg-stone-800 border-2 border-brand-orange text-brand-orange font-bold shadow hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              {downloadLoading ? "Downloading..." : "Download Backup"}
            </button>

            {!pendingImport ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importLoading}
                className="w-full py-3 rounded-xl bg-white dark:bg-stone-800 border-2 border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 font-bold shadow hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {importLoading ? "Importing..." : "Import Backup (.json or .zip)"}
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-1 font-medium">Ready to import:</p>
                <p className="text-xs text-stone-600 dark:text-stone-300 mb-3">{pendingImport.summary}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => executeImport("overwrite")}
                    disabled={importLoading}
                    className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-bold text-xs shadow hover:shadow-md transition-all disabled:opacity-50"
                  >
                    {importLoading ? "..." : "Overwrite All"}
                  </button>
                  <button
                    onClick={() => executeImport("combine")}
                    disabled={importLoading}
                    className="flex-1 py-2.5 rounded-lg bg-brand-olive text-white font-bold text-xs shadow hover:shadow-md transition-all disabled:opacity-50"
                  >
                    {importLoading ? "..." : "Combine (Merge)"}
                  </button>
                </div>
                <button
                  onClick={() => setPendingImport(null)}
                  className="w-full mt-2 text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.zip,application/json,application/zip"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>

          {lastOnlineBackup && (
            <div className="flex items-center gap-1.5 mt-4 text-xs text-stone-400">
              <Clock className="w-3 h-3" />
              Latest restore point: {new Date(lastOnlineBackup).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
