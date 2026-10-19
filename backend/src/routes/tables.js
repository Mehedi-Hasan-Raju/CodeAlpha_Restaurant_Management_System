const router = require('express').Router();
const { emit } = require('../realtime');
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
require('../utils/idParam')(router);

router.use(authenticate);
const adminOnly = requireRole('ADMIN');
const staff = requireRole('ADMIN', 'CASHIER');

const STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];
const posInt = (v) => Number.isInteger(Number(v)) && Number(v) >= 1;

// include the next upcoming reservation, so the floor plan can show "Bennett Family 19:30"
const include = {
  reservations: {
    where: { status: 'UPCOMING', reservedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { reservedAt: 'asc' },
    take: 1,
  },
};

const fmt = ({ reservations, ...t }) => ({
  ...t,
  nextReservation: reservations && reservations[0]
    ? { guestName: reservations[0].guestName, partySize: reservations[0].partySize, reservedAt: reservations[0].reservedAt }
    : null,
});

router.get('/', asyncHandler(async (req, res) => {
  const { area, status } = req.query;
  const where = {};
  if (area) where.area = String(area);
  if (STATUSES.includes(status)) where.status = status;
  const rows = await prisma.diningTable.findMany({ where, orderBy: { id: 'asc' }, include: { reservations: include.reservations } });
  res.json(rows.map(fmt));
}));

router.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { name, seats, area, status } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  if (!posInt(seats)) return res.status(400).json({ error: 'seats must be a whole number >= 1' });
  if (!area || !String(area).trim()) return res.status(400).json({ error: 'area is required' });
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });
  const row = await prisma.diningTable.create({
    data: { name: String(name).trim(), seats: Number(seats), area: String(area).trim(), status: status || 'AVAILABLE' },
  });
  res.status(201).json(row);
}));

router.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const { name, seats, area, status } = req.body || {};
  const data = {};
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });
    data.name = String(name).trim();
  }
  if (seats !== undefined) {
    if (!posInt(seats)) return res.status(400).json({ error: 'seats must be a whole number >= 1' });
    data.seats = Number(seats);
  }
  if (area !== undefined) {
    if (!String(area).trim()) return res.status(400).json({ error: 'area cannot be empty' });
    data.area = String(area).trim();
  }
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });
    data.status = status;
  }
  res.json(await prisma.diningTable.update({ where: { id: req.id }, data }));
}));

// Cashier or admin changes only the status (seat a guest, mark cleaning, mark available)
router.patch('/:id/status', staff, asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'status must be one of ' + STATUSES.join(', ') });
  const t = await prisma.diningTable.update({ where: { id: req.id }, data: { status } });
  emit('table:changed', { id: t.id });
  res.json(t);
}));

// A table that already has orders or reservations cannot be deleted (409)
router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  await prisma.diningTable.delete({ where: { id: req.id } });
  res.json({ ok: true });
}));

module.exports = router;