export async function isDispatchAuthorized(
  suppliedSecret: string | null,
  environmentSecret: string | undefined,
  verifyVaultSecret: (secret: string) => Promise<boolean>,
): Promise<boolean> {
  if (!suppliedSecret || suppliedSecret.length < 32) return false
  if (environmentSecret && suppliedSecret === environmentSecret) return true
  return verifyVaultSecret(suppliedSecret)
}
