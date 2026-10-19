'use client';
import { useStore } from '@/lib/store';
import { Badge, Table, money } from '@/components/Ui';

export default function Page() {
  const { dashboard, dashboardError, loading, dataLoaded } = useStore();
  if (!dashboard) {
    return <>
      <h1>Dashboard</h1>
      <p className="sub">{loading || !dashboardError && dataLoaded ? 'Loading dashboard...' : dashboardError || 'Connect to the API to load dashboard data.'}</p>
    </>;
  }

  const { cards, salesByDay, ordersByType, topItems, recentOrders } = dashboard;
  const maxRevenue = Math.max(1, ...salesByDay.map(day => day.revenue));
  const typeTotal = ordersByType.reduce((sum, type) => sum + type.count, 0);
  const typeStops = ordersByType.map(type => typeTotal ? type.count / typeTotal * 100 : 0);
  const typeLabels = { DINE_IN: 'Dine-in', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery' };
  const typeBackground = typeTotal
    ? `conic-gradient(var(--ac) 0 ${typeStops[0]}%, var(--bl) ${typeStops[0]}% ${typeStops[0] + typeStops[1]}%, var(--ok) ${typeStops[0] + typeStops[1]}% 100%)`
    : 'conic-gradient(var(--bd) 0 100%)';
  return (
    <>
      <h1>Dashboard</h1><p className="sub">Live restaurant performance · {dashboard.range.from} to {dashboard.range.to}</p>
      <div className="stats">
        {[
          ['Revenue', money(cards.revenue.value), cards.revenue.change],
          ['Orders', cards.orders.value, cards.orders.change],
          ['Customers', cards.customers.total, `${cards.customers.new} new`],
          ['Avg. order', money(cards.avgOrder.value), cards.avgOrder.change],
        ].map(([label, value, change]) => (
          <div className="card" key={label}>
            <span className="sub">{label}</span><b>{value}</b>
            <span className={'b ' + (typeof change === 'number' && change < 0 ? 'Pending' : 'Paid')}>
              {change == null ? 'No previous period' : typeof change === 'number' ? `${change > 0 ? '+' : ''}${change}%` : change}
            </span>
          </div>
        ))}
      </div>
      <div className="two">
        <div className="card"><b>Sales by day</b><div className="bars">
          {salesByDay.map(day => <div key={day.date} title={`${day.orders} orders · ${money(day.revenue)}`}>
            <i style={{ height: `${day.revenue / maxRevenue * 110}px` }} />{day.date.slice(5)}
          </div>)}
        </div></div>
        <div className="card"><b>Orders by type</b><div className="donut" style={{ background: typeBackground }} />
          <div className="sub" style={{ textAlign: 'center' }}>{ordersByType.map(type => `${typeLabels[type.type] || type.type} ${type.percent}%`).join(' · ')}</div>
        </div>
      </div>
      <div className="two">
        <div><b>Recent orders</b><br /><br />
          <Table h={['Order', 'Type', 'Status', 'Total']} rows={recentOrders.map(order => [
            <b key={order.id}>#{order.id}</b>,
            typeLabels[order.type] || order.type,
            <Badge key={`${order.id}-status`} s={order.status[0] + order.status.slice(1).toLowerCase()} />,
            money(order.total),
          ])} />
        </div>
        <div className="card"><b>Top items</b>
          {topItems.map(item => <div className="ln" style={{ marginTop: 10 }} key={item.menuItemId}>
            <span>{item.name}</span><b>{item.quantity} sold</b>
          </div>)}
          {!topItems.length && <p className="sub">No item sales in this period.</p>}
        </div>
      </div>
    </>
  );
}
