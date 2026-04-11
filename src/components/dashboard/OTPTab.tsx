import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, ChevronDown, ChevronRight, Download, RotateCcw, Edit2, Check, Plus, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { generateTotp, fetchPersistentCodes, updatePersistentCode, addPersistentCode, deletePersistentCode } from "../../lib/api";
import type { PersistentCode } from "../../lib/types";

export default function OTPTab() {
  const [otpData, setOtpData] = useState<{
    code: string;
    remaining_seconds: number;
    qr_uri: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  // Persistent codes state
  const [persistentCodes, setPersistentCodes] = useState<PersistentCode[]>([]);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [codeQrUrls, setCodeQrUrls] = useState<Record<string, string>>({});
  const [customCodeDraft, setCustomCodeDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = () =>
      generateTotp()
        .then((data) => {
          setOtpData(data);
          setCountdown(data.remaining_seconds);
          const qrUrl = `${window.location.origin}/?otp=${data.code}`;
          QRCode.toDataURL(qrUrl, { width: 200, margin: 2 }).then(setQrDataUrl).catch(() => {});
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30000);
    return () => clearInterval(poll);
  }, []);

  // Local countdown timer (ticks every second)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          generateTotp()
            .then((data) => {
              setOtpData(data);
              setCountdown(data.remaining_seconds);
              const qrUrl = `${window.location.origin}/?otp=${data.code}`;
              QRCode.toDataURL(qrUrl, { width: 200, margin: 2 }).then(setQrDataUrl).catch(() => {});
            })
            .catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Load persistent codes
  useEffect(() => {
    fetchPersistentCodes().then(setPersistentCodes).catch(() => {});
  }, []);

  // Generate QR data URLs for persistent codes
  const generateCodeQrs = useCallback((codes: PersistentCode[]) => {
    const origin = window.location.origin;
    for (const pc of codes) {
      const qrUrl = `${origin}/?otp=${pc.code}`;
      QRCode.toDataURL(qrUrl, { width: 200, margin: 2 })
        .then((url) => setCodeQrUrls((prev) => ({ ...prev, [pc.id]: url })))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (persistentCodes.length > 0) generateCodeQrs(persistentCodes);
  }, [persistentCodes, generateCodeQrs]);

  const handleToggleCode = async (id: string, enabled: boolean) => {
    try {
      const updated = await updatePersistentCode(id, { enabled });
      setPersistentCodes(updated);
    } catch {}
  };

  const handleRegenerateCode = async (id: string) => {
    try {
      const updated = await updatePersistentCode(id, { regenerate: true });
      setPersistentCodes(updated);
    } catch {}
  };

  const handleAddCode = async () => {
    try {
      const updated = await addPersistentCode();
      setPersistentCodes(updated);
    } catch {}
  };

  const handleDeleteCode = async (id: string) => {
    try {
      const updated = await deletePersistentCode(id);
      setPersistentCodes(updated);
      if (expandedCode === id) setExpandedCode(null);
    } catch {}
  };

  const handleSaveLabel = async (id: string) => {
    if (!labelDraft.trim()) return;
    try {
      const updated = await updatePersistentCode(id, { label: labelDraft.trim() });
      setPersistentCodes(updated);
      setEditingLabel(null);
    } catch {}
  };

  const handleSetCustomCode = async (id: string) => {
    const code = customCodeDraft[id];
    if (!code || !/^\d{6}$/.test(code)) return;
    try {
      const updated = await updatePersistentCode(id, { custom_code: code });
      setPersistentCodes(updated);
      setCustomCodeDraft((prev) => ({ ...prev, [id]: "" }));
    } catch {}
  };

  const handleDownloadQr = async (pc: PersistentCode) => {
    const qrUrl = `${window.location.origin}/?otp=${pc.code}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 400, margin: 2 });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise((resolve) => { qrImg.onload = resolve; });

    const padding = 40;
    const textHeight = 80;
    canvas.width = qrImg.width + padding * 2;
    canvas.height = qrImg.height + padding * 2 + textHeight;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(qrImg, padding, padding);

    ctx.fillStyle = "#1c1917";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText(pc.code, canvas.width / 2, qrImg.height + padding + 40);
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#78716c";
    ctx.fillText(pc.label, canvas.width / 2, qrImg.height + padding + 70);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bnb-${pc.label.toLowerCase().replace(/\s+/g, "-")}-${pc.code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const totalPeriod = 600;
  const progress = countdown / totalPeriod;

  return (
    <div className="flex flex-col items-center py-8 md:py-12">
      <h2 className="font-serif text-2xl font-black text-stone-800 dark:text-stone-200 mb-2">
        Purchase Visit Verification Code
      </h2>
      <p className="text-stone-500 dark:text-stone-400 text-sm mb-8 text-center">
        Show this code to customers to verify their visit
      </p>

      {otpData ? (
        <>
          {/* Code display */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-stone-300 dark:border-stone-700 px-4 sm:px-8 md:px-12 py-6 md:py-8 mb-4 overflow-hidden">
            <p className="text-[clamp(1.75rem,8vw,4.5rem)] font-mono font-black tracking-[0.2em] sm:tracking-[0.3em] text-brand-orange text-center select-all">
              {otpData.code}
            </p>
          </div>

          {/* Timer bar */}
          <div className="w-full max-w-xs mb-8">
            <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-orange transition-all duration-1000 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-2 text-stone-500 dark:text-stone-400">
              <RefreshCw className={`w-3.5 h-3.5 ${countdown <= 30 ? "animate-spin" : ""}`} />
              <span className="text-xs font-medium tabular-nums">
                Refreshes in {minutes}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* QR Code */}
          {qrDataUrl && (
            <div className="mb-2 bg-white rounded-2xl p-3 shadow-md border border-stone-300 dark:border-stone-700">
              <img src={qrDataUrl} alt="Scan to verify visit" className="w-44 h-44" />
            </div>
          )}
          <p className="text-stone-400 text-xs mb-8 text-center">Customers scan this QR code to auto-verify</p>

          {/* Instructions */}
          <div className="max-w-sm bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-300 dark:border-stone-700 p-5 mb-12">
            <h3 className="font-bold text-sm text-stone-700 dark:text-stone-300 mb-2">
              How it works
            </h3>
            <ol className="text-sm text-stone-500 dark:text-stone-400 space-y-1 list-decimal list-inside">
              <li>Customer scans the QR code or opens Rewards on the website</li>
              <li>They log in with their phone or email</li>
              <li>The code auto-verifies (or they enter it manually)</li>
              <li>Their purchase visit count goes up (max 1 per day)</li>
              <li>After 10 purchase visits, they earn a free drink!</li>
            </ol>
          </div>
        </>
      ) : (
        <p className="text-stone-400 mb-12">Loading code...</p>
      )}

      {/* Persistent Verification Codes */}
      <div className="w-full max-w-md">
        <h3 className="font-serif text-xl font-black text-stone-800 dark:text-stone-200 mb-2 text-center">
          Persistent Verification Codes
        </h3>
        <p className="text-stone-500 dark:text-stone-400 text-sm mb-6 text-center">
          These codes never expire. Print and place at different stations.
        </p>

        <div className="space-y-2">
            {persistentCodes.map((pc) => {
              const isExpanded = expandedCode === pc.id;
              return (
                <div
                  key={pc.id}
                  className={`rounded-2xl border transition-all ${
                    pc.enabled
                      ? "bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
                      : "bg-stone-100 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700/50 opacity-60"
                  }`}
                >
                  {/* Collapsed row */}
                  <button
                    onClick={() => setExpandedCode(isExpanded ? null : pc.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                    )}
                    <span className="font-bold text-sm text-stone-800 dark:text-stone-200 flex-1 truncate">
                      {pc.label}
                    </span>
                    <span className="font-mono text-sm font-bold text-brand-orange tracking-wider">
                      {pc.code}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCode(pc.id, !pc.enabled);
                      }}
                      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                        pc.enabled ? "bg-brand-olive" : "bg-stone-300 dark:bg-stone-600"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-all ${
                          pc.enabled ? "left-5.5" : "left-0.5"
                        }`}
                        style={{ left: pc.enabled ? "22px" : "2px" }}
                      />
                    </button>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="border-t border-stone-200 dark:border-stone-700 pt-4">
                        {/* Label editing */}
                        <div className="flex items-center gap-2 mb-4">
                          {editingLabel === pc.id ? (
                            <>
                              <input
                                type="text"
                                value={labelDraft}
                                onChange={(e) => setLabelDraft(e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-brand-olive"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveLabel(pc.id)}
                                className="p-1.5 rounded-lg bg-brand-olive text-white"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm font-bold text-stone-700 dark:text-stone-300">
                                {pc.label}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingLabel(pc.id);
                                  setLabelDraft(pc.label);
                                }}
                                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* QR Code */}
                        {codeQrUrls[pc.id] && (
                          <div className="flex justify-center mb-4">
                            <div className="bg-white rounded-xl p-2 shadow-sm border border-stone-200">
                              <img src={codeQrUrls[pc.id]} alt={pc.label} className="w-36 h-36" />
                            </div>
                          </div>
                        )}

                        {/* Custom code input */}
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Custom 6-digit code"
                            value={customCodeDraft[pc.id] || ""}
                            onChange={(e) =>
                              setCustomCodeDraft((prev) => ({ ...prev, [pc.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))
                            }
                            className="flex-1 px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm text-stone-800 dark:text-stone-200 outline-none font-mono text-center tracking-wider"
                          />
                          <button
                            onClick={() => handleSetCustomCode(pc.id)}
                            disabled={!customCodeDraft[pc.id] || !/^\d{6}$/.test(customCodeDraft[pc.id] || "")}
                            className="px-3 py-1.5 rounded-lg bg-brand-olive text-white text-xs font-bold disabled:opacity-40"
                          >
                            Set
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownloadQr(pc)}
                            disabled={!pc.enabled}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download QR
                          </button>
                          <button
                            onClick={() => handleRegenerateCode(pc.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Regenerate
                          </button>
                        </div>
                        <button
                          onClick={() => handleDeleteCode(pc.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-bold transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove Code
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {persistentCodes.length < 10 && (
            <button
              onClick={handleAddCode}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 text-sm font-bold hover:border-brand-olive hover:text-brand-olive transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Code ({persistentCodes.length}/10)
            </button>
          )}
        </div>
    </div>
  );
}
