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
  className,
}: {
  category: ExpenseCategory
  className?: string
}) {
  const iconClassName = 'size-[19px]'
  const icon = category === 'groceries'
    ? <ShoppingCart className={iconClassName} />
    : category === 'household'
      ? <Home className={iconClassName} />
      : category === 'dining'
        ? <Utensils className={iconClassName} />
        : category === 'transportation'
          ? <CarFront className={iconClassName} />
          : category === 'utilities'
            ? <Lightbulb className={iconClassName} />
            : category === 'entertainment'
              ? <Film className={iconClassName} />
              : category === 'health'
                ? <HeartPulse className={iconClassName} />
                : <Package className={iconClassName} />

  return (
    <span
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full bg-(--sage) text-(--forest)',
        category === 'dining' && 'bg-(--gold-soft) text-[#8b6413]',
        category === 'transportation' && 'bg-(--blue-soft) text-(--blue)',
        category === 'utilities' && 'bg-[#fff3c8] text-[#8a6a00]',
        category === 'entertainment' && 'bg-[#e8e6f7] text-[#5c5795]',
        category === 'health' && 'bg-(--coral-soft) text-(--coral)',
        className,
      )}
    >
      {icon}
    </span>
  )
}
