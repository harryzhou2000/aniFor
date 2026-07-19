export interface RenderScaleNavigationOptions {
  readonly currentUrl: string;
  /** Render/wall labs must never replace the user's ordinary-world autosave. */
  readonly diagnosticScene: boolean;
  readonly persist: () => void;
  readonly assign: (href: string) => void;
}

/** Persists an ordinary world synchronously before render-scale navigation reloads it. */
export function navigateToRenderScale(
  scale: number, options: RenderScaleNavigationOptions,
): void {
  if (!options.diagnosticScene) options.persist();
  const url = new URL(options.currentUrl);
  url.searchParams.set('renderScale', String(scale));
  options.assign(url.href);
}
