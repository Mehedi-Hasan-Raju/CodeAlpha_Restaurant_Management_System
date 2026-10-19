'use client';
export const money = n => '$' + Number(n).toFixed(2);
export const orderTotal = o => o.lines.reduce((s, [q, , p]) => s + q * p, 0);
export const Badge = ({ s }) => <span className={'b ' + String(s).split(' ')[0]}>{s}</span>;
export const Thumb = ({ v, c = 'ts' }) => String(v).startsWith('data:') ? <img className={c} src={v} alt="" /> : <span className={c}>{v}</span>;
export const Head = ({ t, s, btn, onBtn }) => (
  <div className="bar"><div><h1>{t}</h1><div className="sub">{s}</div></div><span className="sp" />{btn && <button className="btn" onClick={onBtn}>{btn}</button>}</div>
);
export const Table = ({ h, rows }) => (
  <div className="card tw"><table><thead><tr>{h.map((x, i) => <th key={i}>{x}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
);
export const Modal = ({ title, onClose, onOk, ok = 'Save', size = 'default', okDisabled = false, children }) => (
  <div className="ov" onClick={e => e.target == e.currentTarget && onClose()}>
    <div className={'card mod' + (size === 'medium' ? ' mod-medium' : '')}><b style={{ fontSize: 16 }}>{title}</b>{children}
      <div className="bar" style={{ margin: '6px 0 0', justifyContent: 'flex-end' }}>
        <button className="btn o" onClick={onClose}>Cancel</button>{onOk && <button className="btn" disabled={okDisabled} onClick={onOk}>{ok}</button>}
      </div></div>
  </div>
);
// Resize an uploaded image to max 480px and return a data URL (backend part will upload real files instead)
export const toDataUrl = f => new Promise(res => {
  const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onload = () => {
    const s = Math.min(1, 480 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    res(c.toDataURL('image/jpeg', .8)); }; im.src = r.result; };
  r.readAsDataURL(f);
});
