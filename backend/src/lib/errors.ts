// Thrown inside a db.transaction() callback to force a rollback when a
// conditional UPDATE's WHERE clause matches zero rows — i.e. the row's
// state changed between our initial read and the write (a concurrent
// request beat us to it). Caught by the route to turn into a clean 409
// instead of silently committing a half-applied change.
export class ConflictError extends Error {}

// An upload refused for something about the file itself (too large, not an
// allowed image type): the client's to fix, so routes answer with `status`
// and this message. Anything else uploadFile throws (storage being down) is
// ours, and goes to app.onError as a 500 that's reported.
export class UploadRejectedError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413
  ) {
    super(message);
  }
}
