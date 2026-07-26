import type { DatabaseSync } from "node:sqlite";
export class Store {
  constructor(readonly db: DatabaseSync) {}
  now() {
    return new Date().toISOString();
  }
  row<T>(sql: string, ...args: unknown[]) {
    return this.db.prepare(sql).get(...(args as any)) as T | undefined;
  }
  all<T>(sql: string, ...args: unknown[]) {
    return this.db.prepare(sql).all(...(args as any)) as T[];
  }
  run(sql: string, ...args: unknown[]) {
    return this.db.prepare(sql).run(...(args as any));
  }
  transaction<T>(fn: () => T) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const x = fn();
      this.db.exec("COMMIT");
      return x;
    } catch (e) {
      try {
        this.db.exec("ROLLBACK");
      } catch {}
      throw e;
    }
  }
}
