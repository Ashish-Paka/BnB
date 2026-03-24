import { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { generateTotp } from "../../lib/api";

export default function OTPTab() {
  const [otpData, setOtpData] = useState<{
    code: string;
    remaining_seconds: number;
    qr_uri: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    const load = () =>
      generateTotp()
        .then((data) => {
          setOtpData(data);
          setCountdown(data.remaining_seconds);
          // Generate QR code
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
          // Refetch when timer hits 0
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

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  // Calculate progress for the countdown ring
  const totalPeriod = 600; // 10 minutes
  const progress = countdown / totalPeriod;

  return (
    <div className="flex flex-col items-center py-8 md:py-12">
      <h2 className="font-serif text-2xl font-black text-stone-800 dark:text-stone-200 mb-2">
        Visit Verification Code
      </h2>
      <p className="text-stone-500 dark:text-stone-400 text-sm mb-8 text-center">
        Show this code to customers to verify their visit
      </p>

      {otpData ? (
        <>
          {/* Code display */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-stone-200/50 dark:border-stone-700/50 px-8 py-6 md:px-12 md:py-8 mb-4">
            <p className="text-5xl md:text-7xl font-mono font-black tracking-[0.3em] text-brand-orange text-center select-all">
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
            <div className="mb-2 bg-white rounded-2xl p-3 shadow-md border border-stone-200/50 dark:border-stone-700/50">
              <img src={qrDataUrl} alt="Scan to verify visit" className="w-44 h-44" />
            </div>
          )}
          <p className="text-stone-400 text-xs mb-8 text-center">Customers scan this QR code to auto-verify</p>

          {/* Instructions */}
          <div className="max-w-sm bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-200/50 dark:border-stone-700/50 p-5">
            <h3 className="font-bold text-sm text-stone-700 dark:text-stone-300 mb-2">
              How it works
            </h3>
            <ol className="text-sm text-stone-500 dark:text-stone-400 space-y-1 list-decimal list-inside">
              <li>Customer scans the QR code or opens Rewards on the website</li>
              <li>They log in with their phone or email</li>
              <li>The code auto-verifies (or they enter it manually)</li>
              <li>Their visit count goes up (max 1 per day)</li>
              <li>After 10 visits, they earn a free drink!</li>
            </ol>
          </div>
        </>
      ) : (
        <p className="text-stone-400">Loading code...</p>
      )}
    </div>
  );
}
