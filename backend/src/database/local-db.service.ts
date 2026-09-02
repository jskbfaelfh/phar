import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalDbService implements OnModuleInit {
  private readonly logger = new Logger(LocalDbService.name);
  private db: Database.Database;
  private dbFilePath: string;

  onModuleInit() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbFilePath = path.join(dataDir, 'dawaee_local.db');
    this.logger.log(`Initializing Local File Database Engine at: ${this.dbFilePath}`);

    this.db = new Database(this.dbFilePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initTables();
  }

  private initTables() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS medicines (
        id TEXT PRIMARY KEY,
        trade_name TEXT NOT NULL,
        scientific_name TEXT,
        dosage_form TEXT,
        strength TEXT,
        manufacturer TEXT,
        barcode TEXT,
        default_units_per_pack INTEGER DEFAULT 1,
        is_verified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        medicine_id TEXT NOT NULL,
        custom_name TEXT,
        units_per_pack INTEGER DEFAULT 1,
        selling_price_pack REAL NOT NULL,
        selling_price_unit REAL NOT NULL,
        min_alert_units INTEGER DEFAULT 5,
        is_public_visible INTEGER DEFAULT 1,
        shelf_location TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_batches (
        id TEXT PRIMARY KEY,
        inventory_item_id TEXT NOT NULL,
        supplier_id TEXT,
        purchase_id TEXT,
        batch_number TEXT,
        purchase_price_pack REAL NOT NULL,
        selling_price_pack REAL,
        selling_price_unit REAL,
        quantity_units_remaining INTEGER NOT NULL,
        expiry_date TEXT NOT NULL,
        is_recalled INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        company_name TEXT,
        balance_due REAL DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL,
        supplier_id TEXT,
        supplier_name TEXT,
        invoice_date TEXT DEFAULT CURRENT_DATE,
        total_amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL DEFAULT 0,
        early_discount_days INTEGER,
        early_discount_percent REAL,
        early_discount_deadline TEXT,
        early_discount_amount REAL,
        early_discount_applied INTEGER DEFAULT 0,
        early_discount_applied_amount REAL DEFAULT 0,
        notes TEXT,
        items_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_invoice_items (
        id TEXT PRIMARY KEY,
        purchase_invoice_id TEXT NOT NULL,
        medicine_id TEXT,
        trade_name TEXT NOT NULL,
        scientific_name TEXT,
        batch_number TEXT,
        expiry_date TEXT NOT NULL,
        quantity_packs INTEGER NOT NULL,
        units_per_pack INTEGER DEFAULT 1,
        purchase_price_pack REAL NOT NULL,
        selling_price_pack REAL NOT NULL,
        total_cost REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        user_id TEXT,
        subtotal REAL NOT NULL,
        discount_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        inventory_item_id TEXT,
        inventory_batch_id TEXT,
        unit_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        payload TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const sql of statements) {
      try {
        this.db.exec(sql);
      } catch (err) {
        this.logger.error(`Error executing SQLite setup statement: ${err.message}`);
      }
    }
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  public execute(sql: string, params: any[] = []): Database.RunResult {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  public getDbFilePath(): string {
    return this.dbFilePath;
  }
}
