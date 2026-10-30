import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

// Cursor (keyset) pagination for lists that change while someone scrolls
// them (new posts and requests arrive live, statuses move). Every list is
// ordered by one ascending key, (rank, value, id): rank is the item's group
// (e.g. "needs an answer" before "ended"), value orders within it, and id
// breaks ties so the order is total. A page is "the next N after this key",
// so an item arriving or changing never shifts what comes next the way an
// offset would (showing something twice, or skipping it).
//
// value is a whole number (a timestamp in microseconds, as bigint) carried
// as a string, never a float: a float can come back from the database
// rounded (Supabase returns float8 to 15 significant digits), and a cursor
// that's off by a microsecond repeats or skips the item at a page boundary.
export const PAGE_SIZE = 20;

export type Cursor = { rank: number; value: string; id: string };

// Opaque to clients: the key of the last item on a page.
export const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify([c.rank, c.value, c.id])).toString("base64url");

const cursorKey = z.tuple([z.number().int(), z.string().regex(/^-?\d{1,19}$/), z.uuid()]);

export const cursorSchema = z.string().transform((text, ctx) => {
  try {
    const [rank, value, id] = cursorKey.parse(JSON.parse(Buffer.from(text, "base64url").toString("utf8")));
    return { rank, value, id } satisfies Cursor;
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid cursor" });
    return z.NEVER;
  }
});

export const limitSchema = z
  .string()
  .regex(/^\d+$/, "Must be a whole number")
  .transform(Number)
  .pipe(z.number().int().min(1).max(50));

export const searchSchema = z.string().trim().max(100);

// Rows strictly after the cursor in (rank, value, id) order. The casts pin
// the parameters' types to the columns'.
export const afterCursor = (rank: SQL, value: SQL, id: SQL, cursor: Cursor) =>
  sql`(${rank}, ${value}, ${id}) > (${cursor.rank}::int, ${cursor.value}::bigint, ${cursor.id}::uuid)`;

// A timestamp as whole microseconds, exactly (extract returns numeric), for
// a sort value; negated, it orders newest first.
export const micros = (column: SQL) => sql`(extract(epoch from ${column}) * 1000000)::bigint`;

// Every word typed must appear somewhere in `text`, in any order, ignoring
// case: "rice curd" finds "Curd rice for 2". % and _ are matched literally.
export function matchesSearch(text: SQL, search: string | undefined): SQL | undefined {
  const terms = (search ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (terms.length === 0) return undefined;
  const conditions = terms.map((term) => sql`${text} ilike ${`%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}`);
  return sql.join(conditions, sql` and `);
}

// Fetch one more row than the page holds to know whether another page
// follows; the cursor is the key of the page's last row.
export function toPage<T extends { id: string; sortRank: number; sortValue: string | number | bigint }>(
  rows: T[],
  limit: number
) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor({ rank: last.sortRank, value: String(last.sortValue), id: last.id })
      : null;
  return { items: items.map(({ sortRank: _rank, sortValue: _value, ...item }) => item), nextCursor };
}
