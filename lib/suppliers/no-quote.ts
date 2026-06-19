export const NO_QUOTE_ON_FILE_LABEL = "No quote on file";

export function isQuoteOnFile(reference: { hasQuoteOnFile?: boolean }): boolean {
  return reference.hasQuoteOnFile !== false;
}
