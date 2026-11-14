/**
 * Bind a lazy resource to the account that requested it, not whichever account
 * happens to be signed in after the asynchronous load.
 */
export async function loadForStableIdentity<T>(
  currentUid: () => string | null | undefined,
  load: () => Promise<T>,
): Promise<{ uid: string; resource: T }> {
  const uid = currentUid();
  if (!uid) throw new Error('Sign in before opening private account data.');
  const resource = await load();
  if (currentUid() !== uid) {
    throw new Error('Your signed-in account changed. Reopen this action from your current account.');
  }
  return { uid, resource };
}
