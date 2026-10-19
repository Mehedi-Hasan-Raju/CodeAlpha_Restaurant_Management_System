'use client';
import { useStore } from '@/lib/store';
import { Badge, Table, money, orderTotal } from '@/components/Ui';

const NEXT_ACTION = { New: 'Start', Preparing: 'Mark ready', Ready: 'Serve' };

export default function Page() {
  const { orders, db, updateOrderStatus, createInvoice, toast, dataLoaded, dataError } = useStore();
  const invoicedOrderIds = new Set(db.invoices.map(invoice => invoice[7]));
  const advance = async order => {
    const next = { New: 'Preparing', Preparing: 'Ready', Ready: 'Served' }[order.st];
    if (!next) return;
    try {
      await updateOrderStatus(order.id, next);
    } catch (error) {
      toast(error.message);
    }
  };
  const makeInvoice = async order => {
    try {
      const invoice = await createInvoice(order.id);
      toast(`Invoice ${invoice.number} created`);
    } catch (error) {
      toast(error.message);
    }
  };
  return (<><h1>Orders</h1><p className="sub">{dataLoaded ? 'Live orders from the restaurant API.' : dataError || 'Loading orders...'}</p>
    <Table h={['Order', 'Type', 'Status', 'For', 'Items', 'Total', '']} rows={orders.map(o => [
      <b key={o.id}>#{o.id}</b>, o.type, <Badge s={o.st} />, o.who,
      o.lines.reduce((s, l) => s + l[0], 0), money(o.total ?? orderTotal(o)),
      <>
        {NEXT_ACTION[o.st] && <button className="chip" onClick={() => advance(o)}>{NEXT_ACTION[o.st]}</button>}
        {!invoicedOrderIds.has(o.id) && o.st !== 'Cancelled' &&
          <button className="chip" onClick={() => makeInvoice(o)}>Create invoice</button>}
      </>,
    ])} /></>);
}
