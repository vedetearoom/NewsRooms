"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { IntelligenceCard } from "@/lib/api";
import { Calendar } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface ArchiveDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  cards: IntelligenceCard[];
  selectedDate: string | null; // ISO date string portion, e.g. "2026-04-12"
  onSelectDate: (date: string | null) => void;
}

export function ArchiveDropdown({ isOpen, onClose, cards, selectedDate, onSelectDate }: ArchiveDropdownProps) {
  const { t } = useTranslation();
  const menuRef = React.useRef<HTMLDivElement>(null);
  useClickOutside({
    ref: menuRef,
    enabled: isOpen,
    onClickOutside: onClose,
  });

  const getLocalDateString = (dateObj: Date) => {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  };

  const dateGroups = React.useMemo(() => {
    const counts = new Map<string, number>();
    cards.forEach((c) => {
      // Use logical local date to avoid timezone shift from UTC
      const d = getLocalDateString(new Date(c.created_at));
      counts.set(d, (counts.get(d) || 0) + 1);
    });
    // Sort descending
    return Array.from(counts.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [cards]);

  const formatDate = (dateStr: string) => {
    const [, month, day] = dateStr.split('-');
    return `${parseInt(month)}月${parseInt(day)}日`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute right-0 top-full z-[140] mt-2 w-52 overflow-hidden rounded-xl border border-black/5 bg-white shadow-xl dark:border-white/10 dark:bg-[#1c1c1e] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
        >
          <div className="p-1.5">
            <div className="text-[11px] font-medium text-zinc-400 px-2.5 py-1.5">
              {t('inbox.archiveByDate')}
            </div>
            
            <button
              onClick={() => { onSelectDate(null); onClose(); }}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm text-left transition-colors",
                !selectedDate ? "bg-zinc-100 dark:bg-white/10 font-medium text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"
              )}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 opacity-70" />
                <span>{t('inbox.archiveAll')}</span>
              </div>
              <span className="text-[11px] opacity-40">{cards.length}</span>
            </button>
          </div>

          {dateGroups.length > 0 && (
            <div className="p-1.5 pt-0">
              <div className="max-h-60 overflow-y-auto">
                {dateGroups.map(([date, count]) => {
                  const isSelected = selectedDate === date;
                  return (
                    <button
                      key={date}
                      onClick={() => { onSelectDate(date); onClose(); }}
                      className={cn(
                        "w-full flex items-center justify-between pr-2.5 pl-9 py-2 mt-0.5 rounded-md text-sm text-left transition-colors",
                        isSelected
                          ? "bg-zinc-100 dark:bg-white/10 font-medium text-zinc-900 dark:text-white"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"
                      )}
                    >
                      <span className="truncate">{formatDate(date)}</span>
                      <span className="text-[11px] opacity-40">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
