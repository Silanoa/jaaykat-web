import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Skeleton } from "./ui";

export function QrImage({
  value,
  label,
  className = "mx-auto aspect-square w-full max-w-[240px]",
}: {
  value: string | null;
  label: string;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSvg(null);
      return;
    }
    void QRCode.toString(value, { type: "svg", margin: 1, width: 360, errorCorrectionLevel: "M" }).then((markup) => {
      if (cancelled) return;
      setSvg(markup.replace(/width="[^"]+"/, 'width="100%"').replace(/height="[^"]+"/, 'height="100%"'));
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!value || !svg) {
    return <Skeleton className={className} />;
  }

  return (
    <div
      className={`${className} bg-white p-2 [&_svg]:h-full [&_svg]:w-full`}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
