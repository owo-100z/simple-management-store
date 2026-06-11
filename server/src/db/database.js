const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../data/data.db'));

function initDB() {
  db.exec(`
    -- 가게 정보
    CREATE TABLE IF NOT EXISTS store (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      open_time  TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    -- 품절 배치 스케줄
    CREATE TABLE IF NOT EXISTS schedules (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id    TEXT    NOT NULL,
      menu_name  TEXT    NOT NULL,
      services   TEXT    NOT NULL,  -- JSON 배열 ex) ["baemin","coupang"]
      end_date   TEXT    NOT NULL,  -- ex) 2026-06-30
      status     TEXT    DEFAULT 'active',  -- active / done
      created_at TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    -- 설정값
    CREATE TABLE IF NOT EXISTS settings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT    NOT NULL UNIQUE,
      value      TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT    DEFAULT (datetime('now', 'localtime'))
    );
  `);

  console.log('DB 초기화 완료');
}

module.exports = { db, initDB };