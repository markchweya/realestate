import Database from "better-sqlite3";

export interface SessionRow {
  id: string;
  phone: string;
  name: string;
  cwd: string;
  created_at: number;
  last_used: number;
  last_cost_usd: number | null;
}

export interface ChatRow {
  phone: string;
  active_session: string | null;
  cwd: string | null;
  /** Name to give the next session created in this chat (set by /new). */
  pending_name: string | null;
}

export class Store {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        phone TEXT PRIMARY KEY,
        active_session TEXT,
        cwd TEXT,
        pending_name TEXT
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        cwd TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_used INTEGER NOT NULL,
        last_cost_usd REAL
      );
      CREATE INDEX IF NOT EXISTS sessions_phone ON sessions(phone, last_used DESC);
      CREATE TABLE IF NOT EXISTS processed_msgs (
        id TEXT PRIMARY KEY,
        at INTEGER NOT NULL
      );
    `);
  }

  /** Returns true the first time a message id is seen, false on webhook retries. */
  markProcessed(id: string): boolean {
    const res = this.db
      .prepare("INSERT OR IGNORE INTO processed_msgs (id, at) VALUES (?, ?)")
      .run(id, Date.now());
    return res.changes > 0;
  }

  pruneProcessed(olderThanMs = 7 * 24 * 3600 * 1000) {
    this.db.prepare("DELETE FROM processed_msgs WHERE at < ?").run(Date.now() - olderThanMs);
  }

  getChat(phone: string): ChatRow {
    const row = this.db.prepare("SELECT * FROM chats WHERE phone = ?").get(phone) as ChatRow | undefined;
    return row ?? { phone, active_session: null, cwd: null, pending_name: null };
  }

  setActiveSession(phone: string, sessionId: string | null) {
    this.db
      .prepare(
        `INSERT INTO chats (phone, active_session) VALUES (?, ?)
         ON CONFLICT(phone) DO UPDATE SET active_session = excluded.active_session, pending_name = NULL`,
      )
      .run(phone, sessionId);
  }

  /** Detach from the current session; the next prompt starts a fresh one called `name`. */
  startNew(phone: string, name: string | null) {
    this.db
      .prepare(
        `INSERT INTO chats (phone, active_session, pending_name) VALUES (?, NULL, ?)
         ON CONFLICT(phone) DO UPDATE SET active_session = NULL, pending_name = excluded.pending_name`,
      )
      .run(phone, name);
  }

  setCwd(phone: string, cwd: string) {
    this.db
      .prepare(
        `INSERT INTO chats (phone, cwd) VALUES (?, ?)
         ON CONFLICT(phone) DO UPDATE SET cwd = excluded.cwd`,
      )
      .run(phone, cwd);
  }

  upsertSession(s: { id: string; phone: string; name: string; cwd: string }) {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO sessions (id, phone, name, cwd, created_at, last_used) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET last_used = excluded.last_used`,
      )
      .run(s.id, s.phone, s.name, s.cwd, now, now);
  }

  recordRun(id: string, costUsd: number | null) {
    this.db
      .prepare("UPDATE sessions SET last_used = ?, last_cost_usd = ? WHERE id = ?")
      .run(Date.now(), costUsd, id);
  }

  getSession(id: string): SessionRow | undefined {
    return this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
  }

  listSessions(phone: string, limit = 10): SessionRow[] {
    return this.db
      .prepare("SELECT * FROM sessions WHERE phone = ? ORDER BY last_used DESC LIMIT ?")
      .all(phone, limit) as SessionRow[];
  }

  close() {
    this.db.close();
  }
}
