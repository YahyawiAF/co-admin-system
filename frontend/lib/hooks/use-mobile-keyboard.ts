"use client";

import { useEffect, useState } from "react";

/** True when a form field is focused or the visual viewport shrinks (mobile keyboard). */
export function useMobileKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;

    const setIfChanged = (next: boolean) => {
      setOpen((prev) => (prev === next ? prev : next));
    };

    const syncViewport = () => {
      if (!vv) return;
      setIfChanged(vv.height < window.innerHeight * 0.82);
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement
      ) {
        setIfChanged(true);
      }
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        const stillFocused =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement;
        if (!stillFocused) {
          if (!vv || vv.height >= window.innerHeight * 0.82) {
            setIfChanged(false);
          }
        }
      }, 80);
    };

    vv?.addEventListener("resize", syncViewport);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      vv?.removeEventListener("resize", syncViewport);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return open;
}
