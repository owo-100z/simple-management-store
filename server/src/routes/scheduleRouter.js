const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { log } = require('../utils/logger');

/**
 * 스케줄 목록 조회
 * GET /api/schedule
 */
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM schedules
    WHERE status = 'active'
    ORDER BY created_at DESC
  `).all();

  res.json({ success: true, data: rows.map(_parseRow) });
});

/**
 * 스케줄 등록
 * POST /api/schedule
 * body: {
 *   menuId:   '123',
 *   menuName: '후라이드치킨',
 *   services: ['baemin', 'coupang'],
 *   endDate:  '2026-06-30'
 * }
 */
router.post('/', (req, res) => {
  const { menuId, menuName, services, endDate } = req.body;

  if (!menuId || !menuName || !services?.length || !endDate) {
    return res.status(400).json({ success: false, message: '필수값 누락 (menuId, menuName, services, endDate)' });
  }

  const stmt = db.prepare(`
    INSERT INTO schedules (menu_id, menu_name, services, end_date, status)
    VALUES (?, ?, ?, ?, 'active')
  `);

  const result = stmt.run(menuId, menuName, JSON.stringify(services), endDate);
  log(`Schedule created: id=${result.lastInsertRowid}, menuId=${menuId}, endDate=${endDate}`);

  res.json({ success: true, data: { id: result.lastInsertRowid } });
});

/**
 * 스케줄 삭제 (done 처리)
 * DELETE /api/schedule/:id
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const stmt = db.prepare(`UPDATE schedules SET status = 'done' WHERE id = ?`);
  const result = stmt.run(id);

  if (result.changes === 0) {
    return res.status(404).json({ success: false, message: '스케줄을 찾을 수 없습니다.' });
  }

  log(`Schedule done: id=${id}`);
  res.json({ success: true });
});

/**
 * services JSON 파싱
 */
function _parseRow(row) {
  return {
    ...row,
    services: JSON.parse(row.services),
  };
}

module.exports = router;
