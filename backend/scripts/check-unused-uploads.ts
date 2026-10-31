// Reports what the nightly orphaned-upload cleanup would delete, without
// deleting anything. Uses DATABASE_URL and the Supabase keys from .env.
import "dotenv/config";
import { sweepOrphanedUploads } from "../src/jobs/orphanedUploadCleanup.js";
import { closeDb } from "../src/db/index.js";

const results = await sweepOrphanedUploads({ dryRun: true });
console.table(results.map(({ deleted: _, ...r }) => r));
await closeDb();
