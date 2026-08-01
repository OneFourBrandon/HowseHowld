import { clsx, type ClassValue } from 'clsx'

/** Compose conditional Tailwind classes without hiding the utility strings. */
export function cn(...values: ClassValue[]) {
  return clsx(values)
}
