import { Zap } from "lucide-react";
import type { PayMethod } from "../lib/schemas";

const IMAGES: Partial<Record<PayMethod, { src: string; alt: string; className: string }>> = {
  wave: { src: "/payment-logos/wave.webp", alt: "Logo Wave", className: "" },
  orange: { src: "/payment-logos/orange-money.svg", alt: "Logo Orange Money", className: "bg-white ring-1 ring-inset ring-black/10" },
  yas: { src: "/payment-logos/yas.svg", alt: "Logo Yas", className: "bg-white p-[3px] ring-1 ring-inset ring-black/10" },
  expresso: { src: "/payment-logos/expresso.webp", alt: "Logo Expresso", className: "" },
};

export function PayLogo({ method, size = 44 }: { method: PayMethod; size?: number }) {
  const box = { width: size, height: size };
  const image = IMAGES[method];
  if (image) {
    return (
      <span data-pay-logo={method} className={`block shrink-0 overflow-hidden rounded-[10px] ${image.className}`} style={box}>
        <img src={image.src} alt={image.alt} width={size} height={size} decoding="async" className="block size-full object-contain" />
      </span>
    );
  }
  return (
    <span data-pay-logo={method} aria-hidden="true" className="grid shrink-0 place-items-center rounded-[10px] bg-[#F7931A] text-white" style={box}>
      <Zap size={Math.round(size * 0.55)} fill="currentColor" strokeWidth={1.5} />
    </span>
  );
}
