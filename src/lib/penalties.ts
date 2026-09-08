export const DEFAULT_PENALTY_TIERS = [1000, 1500, 2000, 2500, 3000]

export function validatePenaltyTiers(tiers: number[]) {
  if (!tiers.length || tiers.length > 20) throw new Error('Choose between 1 and 20 penalty tiers.')
  if (tiers.some(amount => !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000)) {
    throw new Error('Each penalty must be between $0.01 and $10,000.00.')
  }
  if (tiers.some((amount, index) => index > 0 && amount < tiers[index - 1])) {
    throw new Error('Each tier must be at least as much as the previous tier.')
  }
}
