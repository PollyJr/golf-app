import { cn } from "@/lib/cn";

/** A QR code for a path on this site, drawn by our own API as SVG. */
export function QrImage({ path, label, className }: { path: string; label: string; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[15rem] rounded-2xl border border-line bg-white p-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG from our own API */}
      <img src={`/api/qr?path=${encodeURIComponent(path)}`} alt={label} className="aspect-square w-full" />
    </div>
  );
}
