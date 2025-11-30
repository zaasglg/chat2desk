import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSameUrl(current: string, target: any): boolean {
  if (typeof target === 'string') {
    return current === target
  }
  if (target && typeof target.href === 'string') {
    return current === target.href
  }
  return false
}

export function resolveUrl(url: any): string {
  if (typeof url === 'string') {
    return url
  }
  if (url && typeof url.href === 'string') {
    return url.href
  }
  return String(url)
}
