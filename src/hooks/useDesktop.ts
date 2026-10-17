import { useEffect, useState } from "react";

const DESKTOP = "(min-width: 1024px)";

function matchesDesktop(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DESKTOP).matches;
}

export function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(matchesDesktop);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(media.matches);
    media.addEventListener("change", onChange);
    setDesktop(media.matches);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return desktop;
}
