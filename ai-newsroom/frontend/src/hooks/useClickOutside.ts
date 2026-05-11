"use client";

import * as React from "react";

interface UseClickOutsideOptions<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  onClickOutside: () => void;
  enabled?: boolean;
}

export function useClickOutside<T extends HTMLElement>({
  ref,
  onClickOutside,
  enabled = true,
}: UseClickOutsideOptions<T>) {
  React.useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      const element = ref.current;
      if (!element || element.contains(event.target as Node)) return;
      onClickOutside();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [enabled, onClickOutside, ref]);
}
