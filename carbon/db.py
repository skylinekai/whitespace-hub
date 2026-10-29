import os
import sqlite3
from flask import g, current_app

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  site_type TEXT,
  address TEXT,
  country TEXT DEFAULT 'United Kingdom',
  floor_area_m2 REAL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS periods (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  revenue_gbp REAL,
  employees_fte REAL,
  include_stands INTEGER NOT NULL DEFAULT 1,
  locked INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS factors (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  default_category TEXT NOT NULL,
  unit TEXT NOT NULL,
  kg_per_unit REAL NOT NULL,
  wtt_per_unit REAL NOT NULL DEFAULT 0,
  td_per_unit REAL NOT NULL DEFAULT 0,
  mass_kg_per_unit REAL,
  kwh_per_unit REAL,
  module TEXT NOT NULL DEFAULT 'both',
  source TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  factor_id INTEGER REFERENCES factors(id) ON DELETE SET NULL,
  description TEXT,
  activity_date TEXT,
  quantity REAL NOT NULL,
  unit TEXT,
  renewable INTEGER NOT NULL DEFAULT 0,
  data_quality TEXT NOT NULL DEFAULT 'actual',
  evidence TEXT,
  -- snapshot of the factor used, for audit trail
  ef_code TEXT, ef_name TEXT, ef_kg REAL, ef_wtt REAL, ef_td REAL, ef_kwh REAL, ef_source TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_act_period ON activities(period_id);

CREATE TABLE IF NOT EXISTS targets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  base_period_id INTEGER REFERENCES periods(id) ON DELETE SET NULL,
  target_year INTEGER NOT NULL,
  reduction_pct REAL NOT NULL,
  coverage TEXT NOT NULL DEFAULT 's12',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  est_reduction_t REAL,
  cost_gbp REAL,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'idea',
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stands (
  id INTEGER PRIMARY KEY,
  ref TEXT,
  client TEXT NOT NULL,
  show_name TEXT NOT NULL,
  venue TEXT,
  city TEXT,
  country TEXT,
  open_date TEXT,
  size_m2 REAL,
  status TEXT NOT NULL DEFAULT 'estimate',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stand_items (
  id INTEGER PRIMARY KEY,
  stand_id INTEGER NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  factor_id INTEGER REFERENCES factors(id) ON DELETE SET NULL,
  description TEXT,
  quantity REAL NOT NULL,
  multiplier REAL NOT NULL DEFAULT 1,
  uses REAL NOT NULL DEFAULT 1,
  eol TEXT NOT NULL DEFAULT 'none',
  ef_code TEXT, ef_name TEXT, ef_kind TEXT, ef_unit TEXT, ef_kg REAL, ef_wtt REAL, ef_td REAL,
  ef_mass REAL, ef_source TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_stand ON stand_items(stand_id);
"""


def db_path():
    return os.environ.get("DATABASE_PATH") or os.path.join(
        current_app.root_path, "instance", "swcarbon.db")


def connect(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    conn = sqlite3.connect(path, detect_types=0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def get_db():
    if "db" not in g:
        g.db = connect(db_path())
    return g.db


def close_db(_e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def q(sql, args=(), one=False):
    cur = get_db().execute(sql, args)
    rows = cur.fetchall()
    return (rows[0] if rows else None) if one else rows


def ex(sql, args=()):
    db = get_db()
    cur = db.execute(sql, args)
    db.commit()
    return cur.lastrowid


def setting(key, default=None):
    row = q("SELECT value FROM settings WHERE key=?", (key,), one=True)
    return row["value"] if row and row["value"] is not None else default


def set_setting(key, value):
    ex("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
       (key, value))


def init_db(path):
    from factors_seed import FACTORS
    conn = connect(path)
    conn.executescript(SCHEMA)
    count = conn.execute("SELECT COUNT(*) FROM factors").fetchone()[0]
    if count == 0:
        for f in FACTORS:
            conn.execute(
                """INSERT INTO factors(code,name,kind,default_category,unit,kg_per_unit,wtt_per_unit,
                   td_per_unit,mass_kg_per_unit,kwh_per_unit,module,source)
                   VALUES(:code,:name,:kind,:default_category,:unit,:kg_per_unit,:wtt_per_unit,
                   :td_per_unit,:mass_kg_per_unit,:kwh_per_unit,:module,:source)""", f)
        conn.execute("INSERT OR IGNORE INTO settings(key,value) VALUES('factor_set','DESNZ 2025 starter library')")
    conn.execute("INSERT OR IGNORE INTO settings(key,value) VALUES('org_name','Skyline Whitespace')")
    conn.commit()
    conn.close()
