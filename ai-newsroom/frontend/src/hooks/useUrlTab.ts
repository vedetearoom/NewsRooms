import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect } from 'react';

export function useUrlTab<T extends string>(
  queryKey: string,
  defaultValue: T,
  syncAction?: (val: T) => void
): [T, (val: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // The active value is determined purely by the URL query parameter (or default)
  // This guarantees SSR and Client match!
  const activeValue = (searchParams.get(queryKey) as T) || defaultValue;

  // Whenever the URL changes, we sync it back to the Zustand store
  // so the Sidebar can construct links with the last visited tabs.
  useEffect(() => {
    if (syncAction) {
      syncAction(activeValue);
    }
  }, [activeValue, syncAction]);

  const setValue = useCallback(
    (newValue: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newValue === defaultValue) {
        params.delete(queryKey);
      } else {
        params.set(queryKey, newValue);
      }
      
      // router.replace updates the URL without pushing a new history entry
      const newUrl = `${pathname}${params.toString() ? '?' + params.toString() : ''}`;
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, queryKey, pathname, router, defaultValue]
  );

  return [activeValue, setValue];
}
