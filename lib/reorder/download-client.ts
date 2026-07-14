/** Browser-only helpers for FEAT-06 exports. */

export function downloadTextFile(
  filename: string,
  contents: string,
  mimeType: string
): void {
  const blob = new Blob([contents], { type: mimeType });
  downloadBlob(filename, blob);
}

export function downloadBytesFile(
  filename: string,
  bytes: Uint8Array,
  mimeType: string
): void {
  // Copy into a standalone ArrayBuffer so BlobPart typing stays strict-safe.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mimeType });
  downloadBlob(filename, blob);
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
