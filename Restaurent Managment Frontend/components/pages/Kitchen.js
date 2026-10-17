'use client';
import { useStore } from '@/lib/store';
const FLOW = ['New', 'Preparing', 'Ready', 'Served'], NEXT = { New: 'Start preparing', Preparing: 'Mark ready', Ready: 'Mark served' };
export default function Page() {
  const { orders, setOrders } = useStore();
  const adv = id => setOrders(os => os.map(o => o.id == id ? { ...o, st: FLOW[FLOW.indexOf(o.st) + 1] } : o));
  return (<><h1>Kitchen display</h1><p className="sub">Live order queue</p>
    <div className="kan">{FLOW.map(s => (
      <div key={s} className={'col ' + s}><h3>{s} ({orders.filter(o => o.st == s).length})</h3>
        {orders.filter(o => o.st == s).map(o => (
          <div key={o.id} className="card tk"><b>#{o.id}</b> <span className="sub">{o.who}</span>
            <ul>{o.lines.map((l, i) => <li key={i}>{l[0]}× {l[1]}</li>)}</ul>
            {NEXT[s] && <button className="btn" onClick={() => adv(o.id)}>{NEXT[s]}</button>}</div>))}
      </div>))}</div></>);
}
