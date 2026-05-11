import * as React from "react";

export function useSelectableSet<T>() {
  const [selected, setSelected] = React.useState<Set<T>>(new Set());

  const toggle = React.useCallback((value: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }, []);

  const replaceAll = React.useCallback((values: Iterable<T>) => {
    setSelected(new Set(values));
  }, []);

  const clear = React.useCallback(() => {
    setSelected(new Set());
  }, []);

  const remove = React.useCallback((value: T) => {
    setSelected((prev) => {
      if (!prev.has(value)) return prev;
      const next = new Set(prev);
      next.delete(value);
      return next;
    });
  }, []);

  return {
    selected,
    setSelected,
    toggle,
    replaceAll,
    clear,
    remove,
  };
}
