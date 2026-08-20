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
