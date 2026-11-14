export * from "./schema";
export { db, sql } from "./client";

import * as schemaTables from "./schema";

export const schema = schemaTables;
