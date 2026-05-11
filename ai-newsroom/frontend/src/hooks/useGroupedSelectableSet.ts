import * as React from "react";

type GroupedSelectableState<TKey extends string | number, TValue extends string | number> = Record<TKey, Set<TValue>>;

export function useGroupedSelectableSet<TKey extends string | number, TValue extends string | number>() {
  const [selectedByGroup, setSelectedByGroup] = React.useState<GroupedSelectableState<TKey, TValue>>({} as GroupedSelectableState<TKey, TValue>);

  const toggle = React.useCallback((groupId: TKey, value: TValue) => {
    setSelectedByGroup((prev) => {
      const nextSet = new Set(prev[groupId] || []);
      if (nextSet.has(value)) {
        nextSet.delete(value);
      } else {
        nextSet.add(value);
      }
      return { ...prev, [groupId]: nextSet };
    });
  }, []);

  const clear = React.useCallback(() => {
    setSelectedByGroup({} as GroupedSelectableState<TKey, TValue>);
  }, []);

  const totalSelected = React.useMemo(() => {
    return (Object.values(selectedByGroup) as Array<Set<TValue>>).reduce(
      (count, values) => count + values.size,
      0,
    );
  }, [selectedByGroup]);

  return {
    selectedByGroup,
    setSelectedByGroup,
    toggle,
    clear,
    totalSelected,
  };
}
