const router = require('express').Router();
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
require('../utils/idParam')(router);

router.use(authenticate);
const adminOnly = requireRole('ADMIN');
const staff = requireRole('ADMIN', 'CASHIER');

const STATUSES = ['UPCOMING', 'SEATED', 'COMPLETED', 'CANCELLED'];
const posInt = (v) => Number.isInteger(Number(v)) && Number(v) >= 1;
const include = { table: { select: { id: true, name: true } } };

const fmt = ({ table, ...r }) => ({ ...r, tableName: table ? table.name : null });

function parse(b, create) {
  const d = {};
  if (create || b.guestName !== undefined) {
    if (!b.guestName || !String(b.guestName).trim()) return { error: 'guestName is required' };
    d.guestName = String(b.guestName).trim();
  }
  if (create || b.partySize !== undefined) {
    if (!posInt(b.partySize)) return { error: 'partySize must be a whole number >= 1' };
    d.partySize = Number(b.partySize);
  }
  if (create || b.reservedAt !== undefined) {
    const t = new Date(b.reservedAt);
    if (!b.reservedAt || Number.isNaN(t.getTime())) return { error: 'reservedAt must be a valid date and time' };
    if (create && t.getTime() < Date.now() - 60 * 60 * 1000) return { error: 'reservedAt cannot be in the past' };
    d.reservedAt = t;
  }
  if (b.durationMin !== undefined) {
    if (!posInt(b.durationMin) || Number(b.durationMin) > 480) return { error: 'durationMin must be between 1 and 480' };
    d.durationMin = Number(b.durationMin);
  }
  if (b.tableId !== undefined) d.tableId = b.tableId ? Number(b.tableId) : null;
  if (b.customerId !== undefined) d.customerId = b.customerId ? Number(b.customerId) : null;
  return { data: d };
}

// table must exist, be big enough, and be free at that time
async function check(r, excludeId) {
  if (!r.tableId) return null;
  const table = await prisma.diningTable.findUnique({ where: { id: r.tableId } });
  if (!table) return { code: 400, msg: 'Table not found' };
  if (table.seats < r.partySize) return { code: 400, msg: `${table.name} has only ${table.seats} seats` };

  const start = r.reservedAt.getTime();
  const end = start + (r.durationMin || 90) * 60000;
  const day = 24 * 60 * 60 * 1000;
  const others = await prisma.reservation.findMany({
    where: {
      tableId: r.tableId,
      status: { in: ['UPCOMING', 'SEATED'] },
      id: excludeId ? { not: excludeId } : undefined,
      reservedAt: { gte: new Date(start - day), lte: new Date(start + day) },
    },
  });
  const clash = others.find((o) => o.reservedAt.getTime() < end && o.reservedAt.getTime() + o.durationMin * 60000 > start);
  return clash ? { code: 409, msg: `${table.name} is already booked at that time (${clash.guestName})` } : null;
}

router.get('/', asyncHandler(async (req, res) => {
  const { status, date, q } = req.query;
  const where = {};
  if (STATUSES.includes(status)) where.status = status;
  if (q) where.guestName = { contains: String(q), mode: 'insensitive' };
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const from = new Date(date + 'T00:00:00');
    where.reservedAt = { gte: from, lt: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
  }
  const rows = await prisma.reservation.findMany({ where, include, orderBy: { reservedAt: 'asc' } });
  res.json(rows.map(fmt));
}));

router.post('/', staff, asyncHandler(async (req, res) => {
  const { data, error } = parse(req.body || {}, true);
  if (error) return res.status(400).json({ error });
  const problem = await check({ ...data, durationMin: data.durationMin || 90 });
  if (problem) return res.status(problem.code).json({ error: problem.msg });
  res.status(201).json(fmt(await prisma.reservation.create({ data, include })));
}));

// Edit details (guest, time, table...). To change the status use PATCH /:id/status
router.put('/:id', staff, asyncHandler(async (req, res) => {
  const { data, error } = parse(req.body || {}, false);
  if (error) return res.status(400).json({ error });
  const old = await prisma.reservation.findUnique({ where: { id: req.id } });
  if (!old) return res.status(404).json({ error: 'Reservation not found' });
  const problem = await check({ ...old, ...data }, req.id);
  if (problem) return res.status(problem.code).json({ error: problem.msg });
  res.json(fmt(await prisma.reservation.update({ where: { id: req.id }, data, include })));
}));

// Status change also updates the table:  SEATED -> OCCUPIED,  COMPLETED -> CLEANING,  CANCELLED -> frees a RESERVED table
router.patch('/:id/status', staff, asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'status must be one of ' + STATUSES.join(', ') });
  const r = await prisma.reservation.findUnique({ where: { id: req.id } });
  if (!r) return res.status(404).json({ error: 'Reservation not found' });

  const ops = [prisma.reservation.update({ where: { id: req.id }, data: { status }, include })];
  if (r.tableId) {
    if (status === 'SEATED') ops.push(prisma.diningTable.update({ where: { id: r.tableId }, data: { status: 'OCCUPIED' } }));
    if (status === 'COMPLETED') ops.push(prisma.diningTable.update({ where: { id: r.tableId }, data: { status: 'CLEANING' } }));
    if (status === 'CANCELLED') ops.push(prisma.diningTable.updateMany({ where: { id: r.tableId, status: 'RESERVED' }, data: { status: 'AVAILABLE' } }));
  }
  const result = await prisma.$transaction(ops);
  res.json(fmt(result[0]));
}));

router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  await prisma.reservation.delete({ where: { id: req.id } });
  res.json({ ok: true });
}));

module.exports = router;