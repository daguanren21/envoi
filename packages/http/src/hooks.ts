/** A lifecycle callback that may mutate its request-scoped context. */
export type Hook<C> = (ctx: C) => void | Promise<void>;

/** Sequential await, return values ignored — same as ofetch `callHooks`. */
export async function callHooks<C>(ctx: C, hooks: Hook<C> | Hook<C>[] | undefined): Promise<void> {
  if (!hooks) return;
  if (Array.isArray(hooks)) {
    for (const hook of hooks) await hook(ctx);
    return;
  }
  await hooks(ctx);
}

/** Run every hook even when one fails; used by the terminal lifecycle phase. */
export async function callHooksSettled<C>(
  ctx: C,
  hooks: Hook<C> | Hook<C>[] | undefined,
): Promise<unknown[]> {
  const errors: unknown[] = [];
  if (!hooks) return errors;

  if (Array.isArray(hooks)) {
    for (const hook of hooks) {
      try {
        await hook(ctx);
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }

  try {
    await hooks(ctx);
  } catch (error) {
    errors.push(error);
  }
  return errors;
}
