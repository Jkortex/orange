import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn 官方 cn（clsx + tailwind-merge）：条件类名拼接 + 冲突类自动归一
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
