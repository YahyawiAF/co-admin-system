"use client";

import { useEffect, useState } from "react";

/** True when the document/tab (or iOS PWA) is visible. */
export function usePageVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const sync = () => {
      setVisible(document.visibilityState === "visible");
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  return visible;
}

/** Poll interval only while the page is visible; otherwise false. */
export function useVisibleInterval(ms: number | false) {
  const visible = usePageVisible();
  if (!visible || ms === false) return false;
  return ms;
}
