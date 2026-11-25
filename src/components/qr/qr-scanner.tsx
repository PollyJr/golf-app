"use client";

import { Camera, CameraOff } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useT } from "@/components/providers";
import { Button } from "@/components/ui/button";

/** Returns an error to show (and keeps scanning), or `null` when the code was handled. */
export type ScanHandler = (text: string) => Promise<string | null> | string | null;

type CameraState = "starting" | "running" | "denied" | "missing" | "insecure" | "error";

interface Detector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

const SCAN_INTERVAL_MS = 160;
const MAX_FRAME = 720;
const REPEAT_PAUSE_MS = 2_500;

/** The browser's own QR reader where it has one (Chrome on Android), otherwise none. */
async function nativeDetector(): Promise<Detector | null> {
  const Native = (window as unknown as { BarcodeDetector?: { new (options: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (!Native) return null;
  try {
    const formats = await Native.getSupportedFormats();
    return formats.includes("qr_code") ? new Native({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

/**
 * Camera view that reads QR codes. Uses the platform's barcode detector when
 * there is one and falls back to a JavaScript decoder, so it works in every
 * modern browser and in the Android app's WebView. A paste field covers
 * devices without a camera.
 */
export function QrScanner({ onScan }: { onScan: ScanHandler }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>("starting");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let busy = false;
    let lastText = "";
    let lastAt = 0;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setState("insecure");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "missing" : "error");
        return;
      }
      if (stopped || !video.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      setState("running");

      const detector = await nativeDetector();
      const decode = detector ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped) return;
        const element = video.current;
        if (element && element.readyState >= 2 && !busy) {
          busy = true;
          let text: string | null = null;
          try {
            if (detector) {
              text = (await detector.detect(element))[0]?.rawValue ?? null;
            } else if (decode && context) {
              const scale = Math.min(1, MAX_FRAME / Math.max(element.videoWidth, element.videoHeight));
              canvas.width = Math.round(element.videoWidth * scale);
              canvas.height = Math.round(element.videoHeight * scale);
              context.drawImage(element, 0, 0, canvas.width, canvas.height);
              const frame = context.getImageData(0, 0, canvas.width, canvas.height);
              text = decode(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          } catch {
            text = null;
          }
          const now = Date.now();
          // The same unusable code stays in view for a while: say so once.
          if (text && (text !== lastText || now - lastAt > REPEAT_PAUSE_MS)) {
            lastText = text;
            lastAt = now;
            const problem = await onScanRef.current(text);
            if (problem === null) {
              stopped = true;
              stream?.getTracks().forEach((track) => track.stop());
              return;
            }
            setMessage(problem);
            if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
          }
          busy = false;
        }
        timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS);
      };
      void tick();
    }

    void start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function submitManual(event: FormEvent) {
    event.preventDefault();
    if (!manual.trim()) return;
    const problem = await onScan(manual.trim());
    setMessage(problem ?? "");
  }

  const failure =
    state === "denied" ? t("play.qr.cameraDenied") : state === "missing" ? t("play.qr.cameraMissing") : state === "insecure" ? t("play.qr.cameraInsecure") : state === "error" ? t("play.qr.cameraError") : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-[#0b1410]">
        <video ref={video} playsInline muted autoPlay className="size-full object-cover" />
        {state === "running" ? (
          // Viewfinder corners; the camera image underneath stays visible.
          <div aria-hidden="true" className="pointer-events-none absolute inset-[16%]">
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-xl"].map((corner) => (
              <span key={corner} className={`absolute size-10 border-accent ${corner}`} />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[#ecf1e8]">
            <div className="flex flex-col items-center gap-3">
              {failure ? <CameraOff className="size-8 opacity-80" /> : <Camera className="size-8 animate-pulse opacity-80" />}
              <p>{failure ?? t("play.qr.starting")}</p>
            </div>
          </div>
        )}
      </div>

      {message ? (
        <p role="alert" className="rounded-control bg-over-soft px-3.5 py-2.5 text-center text-sm font-medium text-over">
          {message}
        </p>
      ) : null}

      <form onSubmit={(event) => void submitManual(event)} className="flex flex-col gap-1.5">
        <label htmlFor="qr-manual" className="text-[13px] font-semibold text-ink-2">
          {t("play.qr.manualLabel")}
        </label>
        <div className="flex gap-2">
          <input
            id="qr-manual"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder={t("play.qr.manualPlaceholder")}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-3.5 text-[15px] placeholder:text-ink-3 focus:border-brand-fg focus:ring-3 focus:ring-brand-fg/15 focus:outline-none"
          />
          <Button type="submit" variant="secondary" disabled={!manual.trim()}>
            {t("play.qr.manualSubmit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
