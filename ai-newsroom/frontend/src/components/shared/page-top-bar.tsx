"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface PageTopBarProps {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}

export function PageTopBar({
  title,
  badge,
  children,
  className,
  innerClassName,
}: PageTopBarProps) {
  return (
    <div className={cn("w-full bg-white/50 dark:bg-transparent frosted-bar backdrop-blur-sm", className)}>
      <div
        className={cn(
          "flex justify-between items-center w-full py-4",
          innerClassName,
        )}
      >
        <div className="flex items-center gap-4">
          <span className="text-[17px] font-extrabold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">
            {title}
          </span>
          {badge}
        </div>

        {children}
      </div>
    </div>
  );
}

interface PageTopBarBadgeProps {
  text: React.ReactNode;
  animated?: boolean;
  className?: string;
}

export function PageTopBarBadge({
  text,
  animated = false,
  className,
}: PageTopBarBadgeProps) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        "bg-zinc-900/5 text-zinc-500 dark:bg-white/10 dark:text-zinc-400",
        className,
      )}
    >
      {text}
    </span>
  );

  if (!animated) return content;

  return (
    <AnimatePresence>
      <motion.span
        initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
        transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
        className="contents"
      >
        {content}
      </motion.span>
    </AnimatePresence>
  );
}

interface PageTopBarTabOption<T extends string> {
  value: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PageTopBarTabsProps<T extends string> {
  value: T;
  options: PageTopBarTabOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function PageTopBarTabs<T extends string>({
  value,
  options,
  onChange,
  className,
}: PageTopBarTabsProps<T>) {
  return (
    <div className={cn("flex items-center gap-1 p-1", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium tracking-tight transition-all cursor-pointer outline-none group",
              active
                ? "text-zinc-700 dark:text-zinc-200"
                : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300",
            )}
          >
            {active && (
              <motion.div
                layoutId="active-pill-mobbin"
                className="absolute inset-0 bg-white dark:bg-zinc-800 shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Icon
              className={cn(
                "relative z-10 h-4 w-4 transition-transform duration-300",
                active ? "opacity-90" : "opacity-70 group-hover:opacity-100",
              )}
            />
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
