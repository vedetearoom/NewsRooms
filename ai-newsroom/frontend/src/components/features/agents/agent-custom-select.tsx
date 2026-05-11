"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/useClickOutside";

export type AgentSelectOption = {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

interface AgentCustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AgentSelectOption[];
  disabled?: boolean;
  className?: string;
}

export function AgentCustomSelect({ value, onChange, options, disabled, className }: AgentCustomSelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useClickOutside({
    ref,
    enabled: open,
    onClickOutside: () => setOpen(false),
  });

  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label || value;
  const displayIcon = selectedOption?.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(className, "flex items-center justify-between text-left", disabled && "opacity-50 cursor-not-allowed object-none")}
      >
        <span className="flex items-center gap-2 truncate">
          {displayIcon}
          {displayLabel}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 opacity-50 shrink-0 transition-transform ml-2", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white dark:bg-[#111214] border border-zinc-200 dark:border-white/10 rounded-lg shadow-xl z-50 py-1.5 overflow-hidden">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "w-full text-left px-3.5 py-2.5 text-[13px] transition-colors flex items-center justify-between",
                value === option.value
                  ? "bg-zinc-100 dark:bg-white/[0.06] text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-white/[0.03]",
              )}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className="flex items-center gap-2 truncate">
                {option.icon}
                {option.label}
              </span>
              {value === option.value && <Check className="w-3.5 h-3.5 opacity-50 shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
