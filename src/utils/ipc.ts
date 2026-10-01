/**
 * Moving document bytes across the Tauri IPC boundary.
 *
 * A command taking `Vec<u8>` needs a JSON array of numbers on the wire, and a
 * typed array is not accepted for that parameter, so the bytes have to be
 * expanded. There is no way around the expansion itself: `tauri::ipc::Request`
 * exposes an `InvokeBody` rather than a byte slice, and the JavaScript
 * `invoke` has no raw-body mode, so the JSON path is the only one available on
 * this API surface. The expansion cost is therefore documented on the Rust side
 * too, rather than pretended away.
 *
 * What *is* avoidable is everything around it. Callers were reaching this code
 * through a `Blob`, which meant an extra full-size copy to read the bytes, and
 * several of them expanded a copy of a copy. These helpers take the bytes
 * directly and hand over a single expansion.
 */

/** A file's contents as read from disk. */
export type FileBytes = Uint8Array;

/** Invoke a Tauri command, resolved lazily so the module loads without it. */
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: run } = await import('@tauri-apps/api/core');
  return run(cmd, args) as Promise<T>;
}

/**
 * Write document bytes to `path`.
 *
 * @param path     Absolute path from a native save dialog.
 * @param contents The bytes, transferred rather than copied.
 */
export async function writeBinaryFile(path: string, contents: FileBytes): Promise<void> {
  // `Array.from` on a view would be a view, so a plain array is built directly
  // from the bytes. No intermediate Blob or ArrayBuffer is created.
  await invoke('write_pdf_file', { path, contents: Array.from(contents) });
}

/**
 * Read a file's bytes.
 *
 * @returns The contents, or null when the file could not be read.
 */
export async function readBinaryFile(path: string): Promise<FileBytes | null> {
  const result = await invoke<number[] | ArrayBuffer>('read_pdf_file', { path });
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  return Uint8Array.from(result);
}

/** Write a plain-text file. */
export async function writeTextFile(path: string, contents: string): Promise<void> {
  await invoke('write_text_file', { path, contents });
}
