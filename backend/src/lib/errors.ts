// Thrown inside a db.transaction() callback to force a rollback when a
// conditional UPDATE's WHERE clause matches zero rows — i.e. the row's
// state changed between our initial read and the write (a concurrent
// request beat us to it). Caught by the route to turn into a clean 400
// instead of silently committing a half-applied change.
export class ConflictError extends Error {}
