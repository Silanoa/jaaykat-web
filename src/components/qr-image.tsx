import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Skeleton } from "./ui";

export function QrImage({ value, label }: { value: string | null; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSvg(null);
      return;
    }
    void QRCode.toString(value, { type: "svg", margin: 1, width: 240, errorCorrectionLevel: "M" }).then((markup) => {
      if (!cancelled) setSvg(markup);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!value || !svg) {
    return <Skeleton className="mx-auto size-[240px]" />;
  }

  return (
    <div
      className="mx-auto size-[240px] bg-white p-2"
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
