'use client';
import { useStore } from '@/lib/store';
import { Badge, Table, money, orderTotal } from '@/components/Ui';
export default function Page() {
  const { orders } = useStore();
  return (<><h1>Orders</h1><p className="sub">Manage and track all restaurant orders</p>
    <Table h={['Order', 'Type', 'Status', 'For', 'Items', 'Total']} rows={orders.map(o => [<b>#{o.id}</b>, o.type, <Badge s={o.st} />, o.who, o.lines.reduce((s, l) => s + l[0], 0), money(orderTotal(o))])} /></>);
}
