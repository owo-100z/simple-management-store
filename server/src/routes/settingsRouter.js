const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { log } = require('../utils/logger');

/**
 * 설정 전체 조회 또는 특정 설정 조회
 * GET /api/settings
 * GET /api/settings?key=menuGroups
 */
router.get('/', (req, res) => {
  const key = req.query.key;

  // 특정 설정만 조회
  if (key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) {
      return res.status(404).json({ success: false, message: '설정을 찾을 수 없습니다.' });
    }
    let value;
    try {
      value = JSON.parse(row.value);
    } catch {
      value = row.value;
    }
    return res.json({ success: true, data: { [key]: value } });
  }

  // 전체 설정 조회
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = rows.reduce((acc, row) => {
    try {
      acc[row.key] = JSON.parse(row.value);
    } catch {
      acc[row.key] = row.value;
    }
    return acc;
  }, {});
  res.json({ success: true, data: settings });
});

/**
 * 설정 단건 조회
 * GET /api/settings/:key
 */
router.get('/:key', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);

  if (!row) {
    return res.status(404).json({ success: false, message: '설정을 찾을 수 없습니다.' });
  }

  let value;
  try {
    value = JSON.parse(row.value);
  } catch {
    value = row.value;
  }

  res.json({ success: true, data: value });
});

/**
 * 설정 저장 (단건 또는 전체)
 * POST /api/settings
 * body: { key: 'theme', value: 'dark' }
 * 또는 여러 개: { settings: { theme: 'dark', language: 'ko' } }
 */
router.post('/', (req, res) => {
  const { key, value, settings } = req.body;

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET
      value      = excluded.value,
      updated_at = excluded.updated_at
  `);

  // 단건 저장
  if (key !== undefined) {
    upsert.run(key, JSON.stringify(value));
    log(`Settings saved: ${key}`);
    return res.json({ success: true });
  }

  // 다건 저장
  if (settings && typeof settings === 'object') {
    const saveMany = db.transaction((obj) => {
      for (const [k, v] of Object.entries(obj)) {
        upsert.run(k, JSON.stringify(v));
      }
    });
    saveMany(settings);
    log(`Settings saved: ${Object.keys(settings).join(', ')}`);
    return res.json({ success: true });
  }

  res.status(400).json({ success: false, message: 'key/value 또는 settings 객체가 필요합니다.' });
});

/**
 * 설정 삭제
 * DELETE /api/settings/:key
 */
router.delete('/:key', (req, res) => {
  const result = db.prepare('DELETE FROM settings WHERE key = ?').run(req.params.key);

  if (result.changes === 0) {
    return res.status(404).json({ success: false, message: '설정을 찾을 수 없습니다.' });
  }

  log(`Settings deleted: ${req.params.key}`);
  res.json({ success: true });
});

/**
 * 가게 정보 조회
 * GET /api/settings/store/info
 */
router.get('/store/info', (req, res) => {
  const row = db.prepare('SELECT * FROM store ORDER BY id DESC LIMIT 1').get();

  if (!row) {
    return res.status(404).json({ success: false, message: '가게 정보가 없습니다.' });
  }

  res.json({ success: true, data: row });
});

/**
 * 가게 정보 저장
 * POST /api/settings/store/info
 * body: { name: '치킨집', openTime: '11:00' }
 */
router.post('/store/info', (req, res) => {
  const { name, openTime } = req.body;

  if (!name || !openTime) {
    return res.status(400).json({ success: false, message: 'name, openTime은 필수값입니다.' });
  }

  const existing = db.prepare('SELECT id FROM store LIMIT 1').get();

  if (existing) {
    db.prepare('UPDATE store SET name = ?, open_time = ? WHERE id = ?')
      .run(name, openTime, existing.id);
  } else {
    db.prepare('INSERT INTO store (name, open_time) VALUES (?, ?)').run(name, openTime);
  }

  log(`Store info saved: name=${name}, openTime=${openTime}`);
  res.json({ success: true });
});

module.exports = router;
