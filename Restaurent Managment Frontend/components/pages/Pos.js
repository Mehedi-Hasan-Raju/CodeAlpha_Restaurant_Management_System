'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Badge, Thumb, Modal, money } from '@/components/Ui';
const CATS = ['All', 'Pizza', 'Burgers', 'Salads', 'Soups', 'Desserts', 'Drinks'];
// Addon groups per category: [name, multi?, option names, extra prices]
const AO = {
  Pizza: [['Size', 0, ['Regular 10"', 'Large 12"', 'XL 14"'], [0, 1.5, 3]], ['Extra toppings', 1, ['Extra cheese', 'Mushrooms', 'Jalapeños'], [.8, .7, .5]]],
  Burgers: [['Add-ons', 1, ['Extra cheese slice', 'Double patty', 'Bacon'], [.5, 1.2, .9]]],
  Drinks: [['Size', 0, ['Regular 450ml', 'Large 650ml'], [0, .6]]],
  Salads: [['Dressing', 0, ['Honey mustard', 'Caesar', 'Vinaigrette'], [0, 0, 0]]],
};
export default function Page() {
  const { items, setOrders, toast } = useStore();
  const [cart, setCart] = useState([]), [cat, setCat] = useState('All'), [veg, setVeg] = useState(''), [q, setQ] = useState('');
  const [pick, setPick] = useState('Dine-in'), [pop, setPop] = useState(null), [sel, setSel] = useState({});
  const list = items.filter(i => (cat == 'All' || i.cat == cat) && (!veg || i.type == veg) && i.name.toLowerCase().includes(q.toLowerCase()));
  const lines = cart.filter(l => items[l.id]);
  const sub = lines.reduce((s, l) => s + (items[l.id].price + l.ex) * l.n, 0);
  const put = (id, op, ex) => setCart(c => { const k = id + op.join(), l = c.find(x => x.k == k); return l ? c.map(x => x == l ? { ...x, n: x.n + 1 } : x) : [...c, { id, op, ex, n: 1, k }]; });
  const add = it => { const g = AO[it.cat]; if (!g) return put(it.id, [], 0); setSel(Object.fromEntries(g.map((x, gi) => [gi, x[1] ? [] : [0]]))); setPop(it); };
  const ok = () => { let op = [], ex = 0; AO[pop.cat].forEach((x, gi) => sel[gi].forEach(o => { op.push(x[2][o]); ex += x[3][o]; })); put(pop.id, op, ex); setPop(null); };
  const chg = (l, d) => setCart(c => c.map(x => x == l ? { ...x, n: x.n + d } : x).filter(x => x.n > 0));
  const place = () => {
    setOrders(o => [...o, { id: 1010 + o.length, type: pick, st: 'New', who: 'Walk-in', lines: lines.map(l => [l.n, items[l.id].name + (l.op.length ? ` (${l.op.join(', ')})` : ''), items[l.id].price + l.ex]) }]);
    setCart([]); toast('Order placed');
  };
  return (
    <div className="pos">
      <div>
        <div className="bar"><input className="in" placeholder="Search items..." value={q} onChange={e => setQ(e.target.value)} />
          {['Veg', 'Non-Veg'].map(t => <button key={t} className={'chip ' + (veg == t ? 'on' : '')} onClick={() => setVeg(veg == t ? '' : t)}>{t}</button>)}</div>
        <div className="bar">{CATS.map(c => <button key={c} className={'chip ' + (c == cat ? 'on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div>
        <div className="menu">{list.map(i => (
          <div key={i.id} className="card it" onClick={() => add(i)}><Thumb v={i.thumb} c="th" /><div><Badge s={i.type} /></div>
            <div style={{ fontWeight: 700, margin: '4px 0' }}>{i.name}</div><div className="pr">{money(i.price)}</div></div>))}
          {!list.length && <p className="sub">No items match.</p>}</div>
      </div>
      <div className="card cart">
        <b>New order</b>
        <div className="bar" style={{ margin: 0 }}>{['Dine-in', 'Takeaway', 'Delivery'].map(t => <button key={t} className={'chip ' + (t == pick ? 'on' : '')} onClick={() => setPick(t)}>{t}</button>)}</div>
        {lines.length ? lines.map(l => (
          <div className="ln" key={l.k}><span>{items[l.id].name}<br /><small className="sub">{l.op.join(', ') || money(items[l.id].price)}</small></span>
            <span className="qty"><button onClick={() => chg(l, -1)}>−</button> {l.n} <button onClick={() => chg(l, 1)}>+</button></span></div>))
          : <p className="sub" style={{ textAlign: 'center', padding: '30px 0' }}>Cart is empty. Tap an item to add it.</p>}
        <div className="ln"><span className="sub">Subtotal</span><span>{money(sub)}</span></div>
        <div className="ln"><span className="sub">Tax 5%</span><span>{money(sub * .05)}</span></div>
        <div className="tot"><span>Total</span><span>{money(sub * 1.05)}</span></div>
        <button className="btn" disabled={!lines.length} style={lines.length ? {} : { opacity: .5 }} onClick={place}>Place order</button>
      </div>
      {pop && (
        <Modal title={pop.name} ok="Add to order" onClose={() => setPop(null)} onOk={ok}>
          {AO[pop.cat].map((g, gi) => (
            <div key={gi}><b className="g">{g[0]} ({g[1] ? 'pick any' : 'pick one'})</b>
              {g[2].map((n, oi) => (
                <label key={n} className="o">
                  <input type={g[1] ? 'checkbox' : 'radio'} checked={sel[gi].includes(oi)}
                    onChange={() => setSel(s => ({ ...s, [gi]: g[1] ? (s[gi].includes(oi) ? s[gi].filter(x => x != oi) : [...s[gi], oi]) : [oi] }))} />
                  {n} <span className="sub">{g[3][oi] ? '+' + money(g[3][oi]) : ''}</span>
                </label>))}
            </div>))}
        </Modal>
      )}
    </div>
  );
}
