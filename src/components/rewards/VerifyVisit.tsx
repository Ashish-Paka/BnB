import { useState, useRef, useEffect } from "react";
import { ShieldCheck, Camera, X, Gift } from "lucide-react";
import { verifyTotp } from "../../lib/api";

interface Props {
  customerId: string;
  onVerified: (visitCount: number, rewardEarned: boolean) => void;
  onRedeemed?: (rewardsRemaining: number) => void;
  initialCode?: string;
  mode?: "visit" | "redeem";
}

export default function VerifyVisit({ customerId, onVerified, onRedeemed, initialCode, mode = "visit" }: Props) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const autoSubmitted = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<{ stream: MediaStream | null; animFrame: number }>({
    stream: null,
    animFrame: 0,
  });

  const hasBarcodeDetector =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  // Auto-fill and auto-submit if initialCode provided
  useEffect(() => {
    if (initialCode && /^\d{6}$/.test(initialCode) && !autoSubmitted.current) {
      autoSubmitted.current = true;
      const digits = initialCode.split("");
      setCode(digits);
      submitCode(initialCode);
    }
  }, [initialCode]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => stopScanner();
  }, []);

  const stopScanner = () => {
    if (scannerRef.current.stream) {
      scannerRef.current.stream.getTracks().forEach((t) => t.stop());
      scannerRef.current.stream = null;
    }
    cancelAnimationFrame(scannerRef.current.animFrame);
    setShowScanner(false);
  };

  const handleQrResult = (raw: string) => {
    // Extract otp param from URL like /?otp=123456
    const match = raw.match(/[?&]otp=(\d{6})/);
    if (match) {
      stopScanner();
      const digits = match[1].split("");
      setCode(digits);
      submitCode(match[1]);
      return true;
    }
    // Also accept raw 6-digit code
    if (/^\d{6}$/.test(raw)) {
      stopScanner();
      const digits = raw.split("");
      setCode(digits);
      submitCode(raw);
      return true;
    }
    return false;
  };

  const startScanner = async () => {
    setShowScanner(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      scannerRef.current.stream = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      if (hasBarcodeDetector) {
        // Native BarcodeDetector (Chrome/Edge)
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const scan = async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              for (const barcode of barcodes) {
                if (handleQrResult(barcode.rawValue)) return;
              }
            } catch {}
          }
          scannerRef.current.animFrame = requestAnimationFrame(scan);
        };
        scannerRef.current.animFrame = requestAnimationFrame(scan);
      } else {
        // Fallback: jsQR library (Safari/Firefox)
        const jsQR = (await import("jsqr")).default;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        const scan = () => {
          if (videoRef.current && videoRef.current.readyState >= 2 && canvas && ctx) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(imageData.data, canvas.width, canvas.height);
            if (result?.data && handleQrResult(result.data)) return;
          }
          scannerRef.current.animFrame = requestAnimationFrame(scan);
        };
        scannerRef.current.animFrame = requestAnimationFrame(scan);
      }
    } catch {
      stopScanner();
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (newCode.every((d) => d) && value) {
      submitCode(newCode.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    if (pasted.length === 6) submitCode(pasted);
  };

  const submitCode = async (fullCode: string) => {
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await verifyTotp(fullCode, customerId, mode === "redeem");
      setMessage(res.message);
      setIsError(!res.valid);
      if (res.valid) {
        if (res.redeemed && onRedeemed) {
          onRedeemed(res.rewards_remaining ?? 0);
        } else if (res.visit_count !== undefined) {
          onVerified(res.visit_count, res.reward_earned);
        }
      }
    } catch {
      setMessage("Could not verify. Please try again.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${mode === "redeem" ? "bg-green-500/10" : "bg-brand-orange/10"}`}>
        {mode === "redeem" ? (
          <Gift className="w-8 h-8 text-green-600" />
        ) : (
          <ShieldCheck className="w-8 h-8 text-brand-orange" />
        )}
      </div>

      <p className="text-stone-600 dark:text-stone-400 text-sm text-center">
        {mode === "redeem"
          ? "Scan the QR code or enter the code to redeem your free drink"
          : "Scan the QR code or enter the code from the barista"}
      </p>

      {/* Hidden canvas for jsQR fallback */}
      <canvas ref={canvasRef} className="hidden" />

      {/* QR Scanner */}
      {showScanner && (
        <div className="relative w-full max-w-[260px] aspect-square rounded-2xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <button
            onClick={stopScanner}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          {/* Scan guide overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 border-2 border-white/40 rounded-xl" />
          </div>
        </div>
      )}

      {/* Scan button — always shown */}
      {!showScanner && (
        <button
          onClick={startScanner}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${mode === "redeem" ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20"}`}
        >
          <Camera className="w-4 h-4" />
          Scan QR Code
        </button>
      )}

      {!showScanner && (
        <>
          <div className="flex items-center gap-3 w-full max-w-[260px]">
            <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
            <span className="text-xs text-stone-400 font-medium">or enter code</span>
            <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
          </div>

          {/* Code input */}
          <div className="flex gap-2" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-11 h-14 text-center text-2xl font-bold rounded-xl bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none transition-all"
              />
            ))}
          </div>
        </>
      )}

      {message && (
        <p
          className={`text-sm font-medium text-center ${
            isError ? "text-red-500" : "text-green-600 dark:text-green-400"
          }`}
        >
          {message}
        </p>
      )}

      {loading && <p className="text-stone-400 text-sm">Verifying...</p>}
    </div>
  );
}
