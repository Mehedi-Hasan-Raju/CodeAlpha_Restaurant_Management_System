'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Badge, Thumb, Modal, money } from '@/components/Ui';

export default function Page() {
  const { db, ids, items, toast, placeOrder, dataLoaded, dataError } = useStore();
  const [cart, setCart] = useState([]);
  const [cat, setCat] = useState('All');
  const [veg, setVeg] = useState('');
  const [q, setQ] = useState('');
  const [pick, setPick] = useState('Dine-in');
  const [tableId, setTableId] = useState('');
  const [pop, setPop] = useState(null);
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState(false);
  const cats = ['All', ...new Set(db.category.filter(category => category[3] === 'Active').map(category => category[1]))];
  const list = items.filter(item => (cat === 'All' || item.cat === cat) && (!veg || item.type === veg) && item.name.toLowerCase().includes(q.toLowerCase()));
  const lines = cart.filter(line => items[line.itemIndex]);
  const subtotal = lines.reduce((sum, line) => sum + (items[line.itemIndex].price + line.extra) * line.quantity, 0);
  const availableTables = db.tables.map((table, index) => ({ table, id: ids.tables?.[index] }))
    .filter(entry => entry.id != null && entry.table[3] === 'Available');

  const addToCart = (itemIndex, optionIds, optionNames, extra) => {
    const key = `${itemIndex}-${[...optionIds].sort((a, b) => a - b).join(',')}`;
    setCart(current => {
      const existing = current.find(line => line.key === key);
      return existing
        ? current.map(line => line.key === key ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { key, itemIndex, optionIds, optionNames, extra, quantity: 1 }];
    });
  };

  const add = item => {
    const groups = db.addons.filter(group => group[5] === 'Active' && item.addonGroupIds.includes(group[6]));
    if (!groups.length) {
      addToCart(item.id, [], [], 0);
      return;
    }
    setSel(Object.fromEntries(groups.map((group, index) => {
      const first = group[7][0];
      return [index, group[2] === 'Required' && !group[1] && first ? [first.id] : []];
    })));
    setPop({ item, groups });
  };

  const confirmAdd = () => {
    for (let index = 0; index < pop.groups.length; index += 1) {
      if (pop.groups[index][2] === 'Required' && !sel[index]?.length) {
        toast(`Choose an option for ${pop.groups[index][0]}`);
        return;
      }
      if (pop.groups[index][1] === 'Multi' && sel[index].length > pop.groups[index][4]) {
        toast(`Choose no more than ${pop.groups[index][4]} options for ${pop.groups[index][0]}`);
        return;
      }
    }
    const chosen = pop.groups.flatMap((group, index) => group[7].filter(option => sel[index]?.includes(option.id)));
    addToCart(pop.item.id, chosen.map(option => option.id), chosen.map(option => option.name),
      chosen.reduce((sum, option) => sum + Number(option.extraPrice), 0));
    setPop(null);
  };

  const changeQuantity = (line, delta) => setCart(current =>
    current.map(entry => entry.key === line.key ? { ...entry, quantity: entry.quantity + delta } : entry)
      .filter(entry => entry.quantity > 0));

  const changeType = type => {
    setPick(type);
    if (type !== 'Dine-in') setTableId('');
    else if (availableTables.length) setTableId(String(availableTables[0].id));
  };

  const submit = async () => {
    if (pick === 'Dine-in' && !tableId) {
      toast(availableTables.length ? 'Select a table for this order' : 'No available tables');
      return;
    }
    setBusy(true);
    try {
      const order = await placeOrder({
        type: ({ 'Dine-in': 'DINE_IN', Takeaway: 'TAKEAWAY', Delivery: 'DELIVERY' })[pick],
        ...(pick === 'Dine-in' ? { tableId: Number(tableId) } : {}),
        items: lines.map(line => ({
          menuItemId: ids.menu?.[line.itemIndex],
          quantity: line.quantity,
          optionIds: line.optionIds,
        })),
      });
      setCart([]);
      toast(`Order #${order.id} placed`);
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!dataLoaded) return <><h1>Point of sale</h1><p className="sub">{dataError || 'Loading menu and tables...'}</p></>;

  return (
    <div className="pos">
      <div>
        <p className="sub">Orders are priced and saved by the restaurant API.</p>
        <div className="bar"><input className="in" placeholder="Search items..." value={q} onChange={event => setQ(event.target.value)} />
          {['Veg', 'Non-Veg', 'Egg'].map(type => <button key={type} className={'chip ' + (veg === type ? 'on' : '')} onClick={() => setVeg(veg === type ? '' : type)}>{type}</button>)}</div>
        <div className="bar">{cats.map(category => <button key={category} className={'chip ' + (category === cat ? 'on' : '')} onClick={() => setCat(category)}>{category}</button>)}</div>
        <div className="menu">{list.map(item => (
          <div key={item.id} className="card it" onClick={() => add(item)}><Thumb v={item.thumb} c="th" /><div><Badge s={item.type} /></div>
            <div style={{ fontWeight: 700, margin: '4px 0' }}>{item.name}</div><div className="pr">{money(item.price)}</div></div>))}
          {!list.length && <p className="sub">No menu items are available.</p>}</div>
      </div>
      <div className="card cart">
        <b>New order</b>
        <div className="bar" style={{ margin: 0 }}>{['Dine-in', 'Takeaway', 'Delivery'].map(type => <button key={type} className={'chip ' + (type === pick ? 'on' : '')} onClick={() => changeType(type)}>{type}</button>)}</div>
        {pick === 'Dine-in' && <label>Table
          <select className="in" value={tableId} onChange={event => setTableId(event.target.value)}>
            <option value="">Select a table</option>
            {availableTables.map(({ table, id }) => <option key={id} value={id}>{table[0]} · {table[1]} seats</option>)}
          </select>
        </label>}
        {lines.length ? lines.map(line => (
          <div className="ln" key={line.key}><span>{items[line.itemIndex].name}<br /><small className="sub">{line.optionNames.join(', ') || money(items[line.itemIndex].price)}</small></span>
            <span className="qty"><button onClick={() => changeQuantity(line, -1)}>−</button> {line.quantity} <button onClick={() => changeQuantity(line, 1)}>+</button></span></div>))
          : <p className="sub" style={{ textAlign: 'center', padding: '30px 0' }}>Cart is empty. Tap an item to add it.</p>}
        <div className="ln"><span className="sub">Subtotal</span><span>{money(subtotal)}</span></div>
        <div className="ln"><span className="sub">Tax 5%</span><span>{money(subtotal * .05)}</span></div>
        <div className="tot"><span>Total before discounts</span><span>{money(subtotal * 1.05)}</span></div>
        <button className="btn" disabled={!lines.length || busy} style={lines.length ? {} : { opacity: .5 }} onClick={submit}>{busy ? 'Saving order...' : 'Place order'}</button>
      </div>
      {pop && (
        <Modal title={pop.item.name} size="medium" ok="Add to order" onClose={() => setPop(null)} onOk={confirmAdd}>
          <div className="pos-addon-groups">
            {pop.groups.map((group, groupIndex) => (
              <div className="pos-addon-group" key={group[6]}>
                <b className="g">{group[0]} ({group[1] === 'Multi' ? `choose up to ${group[4]}` : 'choose one'})</b>
                {group[7].map(option => (
                  <label key={option.id} className="o">
                    <input type={group[1] === 'Multi' ? 'checkbox' : 'radio'}
                      checked={sel[groupIndex]?.includes(option.id) || false}
                      onChange={() => setSel(current => ({
                        ...current,
                        [groupIndex]: group[1] === 'Multi'
                          ? (current[groupIndex].includes(option.id)
                            ? current[groupIndex].filter(id => id !== option.id)
                            : [...current[groupIndex], option.id])
                          : [option.id],
                      }))} />
                    {option.name} <span className="sub">{Number(option.extraPrice) ? `+${money(option.extraPrice)}` : ''}</span>
                  </label>))}
              </div>))}
          </div>
        </Modal>
      )}
    </div>
  );
}
