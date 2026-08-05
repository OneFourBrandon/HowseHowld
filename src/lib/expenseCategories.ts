import type { ExpenseCategory } from '../types'

export const EXPENSE_CATEGORIES: Array<{
  value: ExpenseCategory
  label: string
  description: string
}> = [
  { value: 'groceries', label: 'Groceries', description: 'Food and grocery runs' },
  { value: 'household', label: 'Household supplies', description: 'Shared home essentials' },
  { value: 'dining', label: 'Dining out', description: 'Restaurants and takeout' },
  { value: 'transportation', label: 'Transportation', description: 'Fuel, parking and transit' },
  { value: 'utilities', label: 'Utilities', description: 'Shared services and utilities' },
  { value: 'entertainment', label: 'Entertainment', description: 'House activities and subscriptions' },
  { value: 'health', label: 'Health & pharmacy', description: 'Health and pharmacy purchases' },
  { value: 'other', label: 'Other', description: 'Other shared purchase' },
]

export const getExpenseCategory = (category: ExpenseCategory) =>
  EXPENSE_CATEGORIES.find((option) => option.value === category) ?? EXPENSE_CATEGORIES.at(-1)!
