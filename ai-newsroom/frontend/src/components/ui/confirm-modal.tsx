"use client";

import * as React from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { toast } from "./use-toast";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
}: ConfirmModalProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "当前操作无法完成。";
      toast.error("操作失败", message);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" onClick={onClose} />
      <div 
        className="relative z-10 w-full max-w-sm bg-white dark:bg-[#111214] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-6"
        style={{ animation: "modalIn 200ms cubic-bezier(0.16,1,0.3,1) forwards" }}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 text-muted-foreground transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          <div className={cn(
            "w-12 h-12 rounded-full mb-4 flex items-center justify-center shadow-inner",
            isDestructive 
              ? "bg-red-100/50 dark:bg-red-500/10 text-red-600 dark:text-red-500" 
              : "bg-amber-100/50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500"
          )}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          
          <h3 className="text-[17px] font-bold text-foreground tracking-tight">{title}</h3>
          <p className="text-[13px] text-muted-foreground mt-2.5 leading-relaxed max-w-[320px] break-words">{description}</p>
        </div>

        <div className="flex gap-3 mt-8">
          <Button 
            variant="outline" 
            className="flex-1 h-9 text-[13px] cursor-pointer" 
            onClick={onClose}
          >
            {cancelText}
          </Button>
          <Button 
            variant={isDestructive ? "destructive" : "default"}
            disabled={isProcessing}
            className={cn(
              "flex-1 h-9 text-[13px] cursor-pointer", 
              isDestructive && "bg-red-500 hover:bg-red-600 text-white border-transparent",
              isProcessing && "opacity-50 cursor-not-allowed"
            )} 
            onClick={handleConfirm}
          >
            {isProcessing ? "处理中..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
