// The browser harness only reads environment variables. Node's runtime remains
// outside the game compilation; no Node dependency is needed for this boundary.
declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>;
};
