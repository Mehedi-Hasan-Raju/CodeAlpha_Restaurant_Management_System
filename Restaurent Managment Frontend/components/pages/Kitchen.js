'use client';
import { useStore } from '@/lib/store';
const FLOW = ['New', 'Preparing', 'Ready', 'Served'], NEXT = { New: 'Start preparing', Preparing: 'Mark ready', Ready: 'Mark served' };
export default function Page() {
  const { orders, updateOrderStatus, toast, dataLoaded, dataError } = useStore();
  const adv = async order => {
    const next = FLOW[FLOW.indexOf(order.st) + 1];
    try {
      await updateOrderStatus(order.id, next);
    } catch (error) {
      toast(error.message);
    }
  };
  return (<><h1>Kitchen display</h1><p className="sub">{dataLoaded ? 'Live order queue' : dataError || 'Loading orders...'}</p>
    <div className="kan">{FLOW.map(s => (
      <div key={s} className={'col ' + s}><h3>{s} ({orders.filter(o => o.st == s).length})</h3>
        {orders.filter(o => o.st == s).map(o => (
          <div key={o.id} className="card tk"><b>#{o.id}</b> <span className="sub">{o.who}</span>
            <ul>{o.lines.map((l, i) => <li key={i}>{l[0]}× {l[1]}</li>)}</ul>
            {NEXT[s] && <button className="btn" onClick={() => adv(o)}>{NEXT[s]}</button>}</div>))}
      </div>))}</div></>);
}
