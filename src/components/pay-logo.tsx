import { Zap } from "lucide-react";
import type { PayMethod } from "../lib/schemas";

const IMAGES: Partial<Record<PayMethod, { src: string; alt: string }>> = {
  wave: { src: "/payment-logos/wave.webp", alt: "Logo Wave" },
  orange: { src: "/payment-logos/orange.svg", alt: "Logo Orange Money" },
};

const INITIALS: Partial<Record<PayMethod, { text: string; className: string }>> = {
  free: { text: "free", className: "bg-[#CD1E25] text-[15px] lowercase tracking-tight" },
  expresso: { text: "ex", className: "bg-[#F2A900] text-[17px] text-ink lowercase" },
};

export function PayLogo({ method, size = 44 }: { method: PayMethod; size?: number }) {
  const box = { width: size, height: size };
  const image = IMAGES[method];
  if (image) {
    return (
      <span data-pay-logo={method} className="block shrink-0 overflow-hidden rounded-[10px] bg-black/5" style={box}>
        <img src={image.src} alt={image.alt} width={size} height={size} decoding="async" className="block size-full object-cover" />
      </span>
    );
  }
  if (method === "lightning") {
    return (
      <span data-pay-logo={method} aria-hidden="true" className="grid shrink-0 place-items-center rounded-[10px] bg-[#F7931A] text-white" style={box}>
        <Zap size={Math.round(size * 0.55)} fill="currentColor" strokeWidth={1.5} />
      </span>
    );
  }
  const initials = INITIALS[method];
  return (
    <span
      data-pay-logo={method}
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[10px] font-bold text-white ${initials?.className ?? "bg-ink"}`}
      style={box}
    >
      {initials?.text ?? method.slice(0, 2)}
    </span>
  );
}
