const cents = (v) => Math.round(Number(v) * 100); // work in whole cents, so there are no decimal errors

// total of COMPLETED payments for an invoice
async function paidCents(db, invoiceId) {
  const a = await db.payment.aggregate({ where: { invoiceId, status: 'COMPLETED' }, _sum: { amount: true } });
  return cents(a._sum.amount || 0);
}

// set the invoice to PAID or PENDING from its completed payments (a cancelled invoice stays cancelled)
async function syncInvoice(tx, invoiceId) {
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (inv.status === 'CANCELLED') return inv;
  const status = (await paidCents(tx, invoiceId)) >= cents(inv.total) ? 'PAID' : 'PENDING';
  return inv.status === status ? inv : tx.invoice.update({ where: { id: invoiceId }, data: { status } });
}

// lock the invoice row, so two payments at the same moment cannot both pass the balance check
const lockInvoice = (tx, id) => tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`;

module.exports = { cents, paidCents, syncInvoice, lockInvoice };