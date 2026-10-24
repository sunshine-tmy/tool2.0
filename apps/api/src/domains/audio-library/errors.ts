export class AudioLibraryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}
export function reject(code: string, message: string, status = 400): never {
  throw new AudioLibraryError(code, message, status);
}
