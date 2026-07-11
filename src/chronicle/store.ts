import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { ConfigManager } from "../config/config-manager.js";
import { ChronicleError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface ChronicleItem {
  id: string;
  content: string;
  type: "knowledge" | "decision" | "context" | "note";
  metadata: Record<string, unknown>;
  embedding: Float64Array | null;
  created_at: string;
  updated_at: string;
}

export interface ChronicleEntity {
  id: string;
  name: string;
  type: "file" | "function" | "decision" | "person" | "issue" | "concept";
  properties: Record<string, unknown>;
  created_at: string;
}

export interface ChronicleRelation {
  id: string;
  from_id: string;
  to_id: string;
  type: "depends_on" | "authored_by" | "decided_in" | "blocks" | "implements" | "related_to";
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TimelineEntry {
  id: string;
  item_id: string;
  snapshot: Record<string, unknown>;
  timestamp: string;
}

interface RawItemRow {
  id: string;
  content: string;
  type: string;
  metadata: string;
  embedding: Buffer | null;
  created_at: string;
  updated_at: string;
}

interface RawEntityRow {
  id: string;
  name: string;
  type: string;
  properties: string;
  created_at: string;
}

interface RawRelationRow {
  id: string;
  from_id: string;
  to_id: string;
  type: string;
  metadata: string;
  created_at: string;
}

interface RawRelationJoinRow extends RawRelationRow {
  e_id: string;
  e_name: string;
  e_type: string;
  e_properties: string;
  e_created_at: string;
}

interface RawTimelineRow {
  id: string;
  item_id: string;
  snapshot: string;
  timestamp: string;
}

export class ChronicleStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'knowledge',
        metadata TEXT NOT NULL DEFAULT '{}',
        embedding BLOB,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (from_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (to_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS timeline (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        snapshot TEXT NOT NULL DEFAULT '{}',
        timestamp TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
      CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
      CREATE INDEX IF NOT EXISTS idx_timeline_item ON timeline(item_id);
      CREATE INDEX IF NOT EXISTS idx_timeline_ts ON timeline(timestamp);
    `);

    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
          content,
          tokenize='porter unicode61'
        );
      `);
    } catch {
      logger.debug("FTS5 table already exists or FTS5 not available");
    }
  }

  static getDbPath(projectDir?: string): string {
    const dir = projectDir ?? process.cwd();
    const hash = crypto.createHash("sha256").update(dir).digest("hex").slice(0, 12);
    const homeDir = ConfigManager.getHomeDir();
    return path.join(homeDir, "chronicle", hash, "chronicle.db");
  }

  static isInitialized(projectDir?: string): boolean {
    return fs.existsSync(ChronicleStore.getDbPath(projectDir));
  }

  static open(projectDir?: string): ChronicleStore {
    const dbPath = ChronicleStore.getDbPath(projectDir);
    if (!fs.existsSync(dbPath)) {
      throw new ChronicleError(
        "Chronicle not initialized for this project",
        "Run 'llm-collab chronicle init' first",
      );
    }
    return new ChronicleStore(dbPath);
  }

  static init(projectDir?: string): ChronicleStore {
    return new ChronicleStore(ChronicleStore.getDbPath(projectDir));
  }

  getPath(): string {
    return this.dbPath;
  }

  // --- Items ---

  addItem(
    content: string,
    type: ChronicleItem["type"] = "knowledge",
    metadata: Record<string, unknown> = {},
    embedding?: Float64Array,
  ): ChronicleItem {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO items (id, content, type, metadata, embedding, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, content, type, JSON.stringify(metadata),
      embedding ? Buffer.from(embedding.buffer) : null,
      now, now,
    );

    this.indexFts(content);
    this.addTimelineEntry(id, { content, type, metadata });

    return { id, content, type, metadata, embedding: embedding ?? null, created_at: now, updated_at: now };
  }

  getItem(id: string): ChronicleItem | null {
    const row = this.db.prepare("SELECT * FROM items WHERE id = ?").get(id) as RawItemRow | undefined;
    return row ? this.parseItemRow(row) : null;
  }

  updateItem(id: string, updates: { content?: string; metadata?: Record<string, unknown>; embedding?: Float64Array }): ChronicleItem | null {
    const existing = this.getItem(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const content = updates.content ?? existing.content;
    const metadata = updates.metadata ?? existing.metadata;
    const embeddingBuf = updates.embedding
      ? Buffer.from(updates.embedding.buffer)
      : existing.embedding
        ? Buffer.from(existing.embedding.buffer)
        : null;

    this.db.prepare("UPDATE items SET content = ?, metadata = ?, embedding = ?, updated_at = ? WHERE id = ?")
      .run(content, JSON.stringify(metadata), embeddingBuf, now, id);

    if (updates.content) {
      this.indexFts(content);
      this.addTimelineEntry(id, { content, type: existing.type, metadata });
    }

    return { ...existing, content, metadata, embedding: updates.embedding ?? existing.embedding, updated_at: now };
  }

  deleteItem(id: string): boolean {
    return this.db.prepare("DELETE FROM items WHERE id = ?").run(id).changes > 0;
  }

  listItems(options: { type?: string; limit?: number; offset?: number } = {}): ChronicleItem[] {
    let sql = "SELECT * FROM items";
    const params: unknown[] = [];

    if (options.type) {
      sql += " WHERE type = ?";
      params.push(options.type);
    }
    sql += " ORDER BY updated_at DESC";
    if (options.limit) {
      sql += " LIMIT ?";
      params.push(options.limit);
    }
    if (options.offset) {
      sql += " OFFSET ?";
      params.push(options.offset);
    }

    return (this.db.prepare(sql).all(...params) as RawItemRow[]).map((r) => this.parseItemRow(r));
  }

  searchByKeyword(query: string, limit = 20): ChronicleItem[] {
    try {
      const rows = this.db.prepare(`
        SELECT i.* FROM items i
        JOIN items_fts fts ON i.rowid = fts.rowid
        WHERE items_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(query, limit) as RawItemRow[];
      return rows.map((r) => this.parseItemRow(r));
    } catch {
      return this.searchByLike(query, limit);
    }
  }

  private searchByLike(query: string, limit: number): ChronicleItem[] {
    return (this.db.prepare("SELECT * FROM items WHERE content LIKE ? ORDER BY updated_at DESC LIMIT ?")
      .all(`%${query}%`, limit) as RawItemRow[]).map((r) => this.parseItemRow(r));
  }

  searchByEmbedding(queryEmbedding: Float64Array, limit = 10): Array<{ item: ChronicleItem; score: number }> {
    const rows = this.db.prepare("SELECT * FROM items WHERE embedding IS NOT NULL").all() as RawItemRow[];
    const results: Array<{ item: ChronicleItem; score: number }> = [];

    for (const row of rows) {
      const item = this.parseItemRow(row);
      if (!item.embedding) continue;
      const score = cosineSimilarity(queryEmbedding, item.embedding);
      results.push({ item, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // --- Entities ---

  addEntity(name: string, type: ChronicleEntity["type"], properties: Record<string, unknown> = {}): ChronicleEntity {
    const existing = this.db.prepare("SELECT * FROM entities WHERE name = ? AND type = ?").get(name, type) as RawEntityRow | undefined;
    if (existing) {
      const merged = { ...JSON.parse(existing.properties), ...properties };
      this.db.prepare("UPDATE entities SET properties = ? WHERE id = ?").run(JSON.stringify(merged), existing.id);
      return this.parseEntityRow({ ...existing, properties: JSON.stringify(merged) });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO entities (id, name, type, properties, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, name, type, JSON.stringify(properties), now);
    return { id, name, type, properties, created_at: now };
  }

  getEntity(id: string): ChronicleEntity | null {
    const row = this.db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as RawEntityRow | undefined;
    return row ? this.parseEntityRow(row) : null;
  }

  findEntity(name: string, type?: string): ChronicleEntity | null {
    const sql = type
      ? "SELECT * FROM entities WHERE name = ? AND type = ?"
      : "SELECT * FROM entities WHERE name = ?";
    const params = type ? [name, type] : [name];
    const row = this.db.prepare(sql).get(...params) as RawEntityRow | undefined;
    return row ? this.parseEntityRow(row) : null;
  }

  listEntities(options: { type?: string; limit?: number } = {}): ChronicleEntity[] {
    let sql = "SELECT * FROM entities";
    const params: unknown[] = [];
    if (options.type) {
      sql += " WHERE type = ?";
      params.push(options.type);
    }
    sql += " ORDER BY name";
    if (options.limit) {
      sql += " LIMIT ?";
      params.push(options.limit);
    }
    return (this.db.prepare(sql).all(...params) as RawEntityRow[]).map((r) => this.parseEntityRow(r));
  }

  deleteEntity(id: string): boolean {
    return this.db.prepare("DELETE FROM entities WHERE id = ?").run(id).changes > 0;
  }

  // --- Relations ---

  addRelation(fromId: string, toId: string, type: ChronicleRelation["type"], metadata: Record<string, unknown> = {}): ChronicleRelation {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO relations (id, from_id, to_id, type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, fromId, toId, type, JSON.stringify(metadata), now);
    return { id, from_id: fromId, to_id: toId, type, metadata, created_at: now };
  }

  getRelations(entityId: string, direction: "from" | "to" | "both" = "both"): Array<ChronicleRelation & { entity: ChronicleEntity }> {
    const results: Array<ChronicleRelation & { entity: ChronicleEntity }> = [];

    if (direction === "from" || direction === "both") {
      const rows = this.db.prepare(`
        SELECT r.*, e.id as e_id, e.name as e_name, e.type as e_type, e.properties as e_properties, e.created_at as e_created_at
        FROM relations r JOIN entities e ON r.to_id = e.id WHERE r.from_id = ?
      `).all(entityId) as RawRelationJoinRow[];
      for (const row of rows) {
        results.push({
          ...this.parseRelationRow(row),
          entity: { id: row.e_id, name: row.e_name, type: row.e_type as ChronicleEntity["type"], properties: JSON.parse(row.e_properties), created_at: row.e_created_at },
        });
      }
    }

    if (direction === "to" || direction === "both") {
      const rows = this.db.prepare(`
        SELECT r.*, e.id as e_id, e.name as e_name, e.type as e_type, e.properties as e_properties, e.created_at as e_created_at
        FROM relations r JOIN entities e ON r.from_id = e.id WHERE r.to_id = ?
      `).all(entityId) as RawRelationJoinRow[];
      for (const row of rows) {
        results.push({
          ...this.parseRelationRow(row),
          entity: { id: row.e_id, name: row.e_name, type: row.e_type as ChronicleEntity["type"], properties: JSON.parse(row.e_properties), created_at: row.e_created_at },
        });
      }
    }

    return results;
  }

  deleteRelation(id: string): boolean {
    return this.db.prepare("DELETE FROM relations WHERE id = ?").run(id).changes > 0;
  }

  // --- Timeline ---

  addTimelineEntry(itemId: string, snapshot: Record<string, unknown>): TimelineEntry {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO timeline (id, item_id, snapshot, timestamp) VALUES (?, ?, ?, ?)")
      .run(id, itemId, JSON.stringify(snapshot), now);
    return { id, item_id: itemId, snapshot, timestamp: now };
  }

  getTimeline(itemId?: string, options: { since?: string; until?: string; limit?: number } = {}): TimelineEntry[] {
    let sql = "SELECT * FROM timeline";
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (itemId) { conditions.push("item_id = ?"); params.push(itemId); }
    if (options.since) { conditions.push("timestamp >= ?"); params.push(options.since); }
    if (options.until) { conditions.push("timestamp <= ?"); params.push(options.until); }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY timestamp DESC";
    if (options.limit) { sql += " LIMIT ?"; params.push(options.limit); }

    return (this.db.prepare(sql).all(...params) as RawTimelineRow[]).map((r) => ({
      id: r.id, item_id: r.item_id, snapshot: JSON.parse(r.snapshot), timestamp: r.timestamp,
    }));
  }

  // --- Stats ---

  stats(): { items: number; entities: number; relations: number; timeline: number } {
    const count = (table: string) => (this.db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
    return { items: count("items"), entities: count("entities"), relations: count("relations"), timeline: count("timeline") };
  }

  close(): void {
    this.db.close();
  }

  // --- Helpers ---

  private indexFts(content: string): void {
    try {
      this.db.prepare("INSERT INTO items_fts(content) VALUES (?)").run(content);
    } catch { /* FTS indexing is best-effort */ }
  }

  private parseItemRow(row: RawItemRow): ChronicleItem {
    return {
      id: row.id, content: row.content, type: row.type as ChronicleItem["type"],
      metadata: JSON.parse(row.metadata),
      embedding: row.embedding ? new Float64Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 8) : null,
      created_at: row.created_at, updated_at: row.updated_at,
    };
  }

  private parseEntityRow(row: RawEntityRow): ChronicleEntity {
    return { id: row.id, name: row.name, type: row.type as ChronicleEntity["type"], properties: JSON.parse(row.properties), created_at: row.created_at };
  }

  private parseRelationRow(row: RawRelationRow): ChronicleRelation {
    return { id: row.id, from_id: row.from_id, to_id: row.to_id, type: row.type as ChronicleRelation["type"], metadata: JSON.parse(row.metadata), created_at: row.created_at };
  }
}

function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
