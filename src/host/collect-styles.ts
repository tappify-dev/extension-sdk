export function collectStyles(remoteModule: unknown): string[] {
  if (typeof remoteModule !== 'object' || remoteModule === null) return [];
  if (!('styles' in remoteModule)) return [];

  const styles = remoteModule.styles;
  if (!Array.isArray(styles)) return [];

  return styles.filter((entry): entry is string => typeof entry === 'string');
}
