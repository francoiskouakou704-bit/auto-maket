/**
 * Dev-only console noise filter.
 *
 * Suppresses known-benign warnings from Lovable dev tooling that don't
 * occur in production builds. Runs only in the browser during dev.
 */
if (import.meta.env.DEV && typeof window !== "undefined") {
  const w = window as unknown as { __lvDevFilterInstalled?: boolean };
  if (!w.__lvDevFilterInstalled) {
    w.__lvDevFilterInstalled = true;

    // Substrings that identify benign dev-tooling warnings. Keep this list
    // narrow — filter only what is truly non-actionable in dev.
    const IGNORED = [
      "data-tsd-source", // componentTagger source attributes (dev only)
      "data-lov-id",     // legacy Lovable tag attribute
    ];

    const shouldIgnore = (args: unknown[]) => {
      for (const a of args) {
        if (typeof a === "string") {
          for (const needle of IGNORED) if (a.includes(needle)) return true;
        }
      }
      return false;
    };

    const origError = console.error.bind(console);
    const origWarn = console.warn.bind(console);

    console.error = (...args: unknown[]) => {
      if (shouldIgnore(args)) return;
      origError(...args);
    };
    console.warn = (...args: unknown[]) => {
      if (shouldIgnore(args)) return;
      origWarn(...args);
    };
  }
}

export {};
