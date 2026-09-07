import {
  CarFront,
  Film,
  HeartPulse,
  Home,
  Lightbulb,
  Package,
  ShoppingCart,
  Utensils,
} from 'lucide-react'
import { cn } from '../lib/cn'
import type { ExpenseCategory } from '../types'

export function ExpenseCategoryIcon({
  category,
  size = 40,
  className,
}: {
  category: ExpenseCategory
  size?: number
  className?: string
}) {
  const iconSize = Math.round(size * 0.47)
  const icon = category === 'groceries'
    ? <ShoppingCart size={iconSize} />
    : category === 'household'
      ? <Home size={iconSize} />
      : category === 'dining'
        ? <Utensils size={iconSize} />
        : category === 'transportation'
          ? <CarFront size={iconSize} />
          : category === 'utilities'
            ? <Lightbulb size={iconSize} />
            : category === 'entertainment'
              ? <Film size={iconSize} />
              : category === 'health'
                ? <HeartPulse size={iconSize} />
                : <Package size={iconSize} />

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-(--blue-soft) text-[#7d9cff]',
        category === 'groceries' && 'bg-(--green-soft) text-(--green)',
        category === 'dining' && 'bg-(--amber-soft) text-(--amber)',
        category === 'transportation' && 'bg-(--pink-soft) text-[#ff7fae]',
        category === 'utilities' && 'bg-(--amber-soft) text-(--amber)',
        category === 'entertainment' && 'bg-(--violet-soft) text-(--violet)',
        category === 'health' && 'bg-(--red-soft) text-[#ff8080]',
        className,
      )}
    >
      {icon}
    </span>
  )
}
