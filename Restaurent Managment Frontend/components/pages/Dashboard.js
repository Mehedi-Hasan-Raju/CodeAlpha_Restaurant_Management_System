'use client';
import { useStore } from '@/lib/store';
import { Badge, Table, money, orderTotal } from '@/components/Ui';
export default function Page() {
  const { orders, db } = useStore();
  const d = [['Mon', 420], ['Tue', 380], ['Wed', 510], ['Thu', 460], ['Fri', 690], ['Sat', 820], ['Sun', 740]], mx = 820, rev = d.reduce((s, x) => s + x[1], 0), n = orders.length + 142;
  return (
    <>
      <h1>Dashboard</h1><p className="sub">Today at a glance</p>
      <div className="stats">{[['Revenue (week)', money(rev), '+12%'], ['Orders', n, '+8%'], ['Customers', db.customers.length, '+3'], ['Avg. order', money(rev / n), '-2%']].map(([a, b, c]) => (
        <div className="card" key={a}><span className="sub">{a}</span><b>{b}</b><span className={'b ' + (c[0] == '-' ? 'Pending' : 'Paid')}>{c}</span></div>))}</div>
      <div className="two">
        <div className="card"><b>Sales this week</b><div className="bars">{d.map(x => <div key={x[0]}><i style={{ height: x[1] / mx * 110 }} />{x[0]}</div>)}</div></div>
        <div className="card"><b>Orders by type</b><div className="donut" /><div className="sub" style={{ textAlign: 'center' }}>Dine-in 55% · Takeaway 25% · Delivery 20%</div></div>
      </div>
      <div className="two">
        <div><b>Recent orders</b><br /><br /><Table h={['Order', 'Type', 'Status', 'Total']} rows={orders.slice(-4).map(o => [<b>#{o.id}</b>, o.type, <Badge s={o.st} />, money(orderTotal(o))])} /></div>
        <div className="card"><b>Top items</b>{db.menu.slice(0, 5).map((x, i) => <div className="ln" style={{ marginTop: 10 }} key={i}><span>{x[1]}</span><b>{90 - i * 11} sold</b></div>)}</div>
      </div>
    </>
  );
}
