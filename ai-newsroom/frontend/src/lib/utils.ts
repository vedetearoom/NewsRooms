import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRelativeTime(dateString: string, language: string = 'en') {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return language === 'zh' ? "刚刚" : "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return language === 'zh' ? `${diffInMinutes}分钟前` : `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return language === 'zh' ? `${diffInHours}小时前` : `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return language === 'zh' ? `${diffInDays}天前` : `${diffInDays}d ago`;
}
