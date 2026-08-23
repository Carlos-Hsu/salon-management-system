import { useEffect, useRef, useState } from 'react';
import { History, Minus, PackagePlus, Plus, Search, Trash2 } from 'lucide-react';
import { api, type Product, type ProductStockAdjustment } from '../api';

type Draft = Product & { id: number };
type Dialog = { type: 'create' } | { type: 'restock' | 'delete' | 'history'; product: Draft };

export function ProductsView({ products, onRefresh }: { products: Product[]; onRefresh(): Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<Dialog>();
  const [quantity, setQuantity] = useState(10);
  const [history, setHistory] = useState<ProductStockAdjustment[]>([]);
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [newProduct, setNewProduct] = useState({ name: '', price: 0, stock_quantity: 0, vendor_name: '' });
  const queues = useRef(new Map<number, Promise<void>>());
  const persisted = useRef(new Map<number, string>());
  const pendingSignatures = useRef(new Map<number, string>());

  const signature = (product: Draft) => JSON.stringify([product.name.trim(), Math.round(product.price), Math.round(product.stock_quantity), product.vendor_name?.trim() || '', product.active]);
  useEffect(() => {
    const next = Object.fromEntries(products.filter((p): p is Draft => p.id !== undefined).map(product => [product.id, { ...product }]));
    setDrafts(next);
    products.forEach(product => { if (product.id !== undefined) persisted.current.set(product.id, signature(product as Draft)); });
  }, [products]);

  const updateDraft = (id: number, patch: Partial<Draft>) => setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  const enqueue = (id: number, operation: () => Promise<void>) => {
    setSaving(current => new Set(current).add(id));
    const pending = (queues.current.get(id) ?? Promise.resolve()).catch(() => undefined).then(operation).catch(error => {
      setMessage(error instanceof Error ? error.message : '產品操作失敗，請稍後再試。');
    }).finally(() => {
      if (queues.current.get(id) === pending) {
        queues.current.delete(id);
        setSaving(current => { const next = new Set(current); next.delete(id); return next; });
      }
    });
    queues.current.set(id, pending);
    return pending;
  };

  const saveDraft = (draft: Draft) => {
    const normalized: Draft = { ...draft, name: draft.name.trim(), price: Math.max(0, Math.round(draft.price)), stock_quantity: Math.max(0, Math.round(draft.stock_quantity)), vendor_name: draft.vendor_name?.trim() || null, active: draft.active ? 1 : 0 };
    const nextSignature = signature(normalized);
    if (!normalized.name) { setMessage('產品名稱不可空白。'); return; }
    if (persisted.current.get(draft.id) === nextSignature || pendingSignatures.current.get(draft.id) === nextSignature) return;
    pendingSignatures.current.set(draft.id, nextSignature);
    updateDraft(draft.id, normalized);
    void enqueue(draft.id, async () => {
      try {
        await api.updateProduct(normalized);
        persisted.current.set(draft.id, nextSignature);
        await onRefresh();
      } finally {
        if (pendingSignatures.current.get(draft.id) === nextSignature) pendingSignatures.current.delete(draft.id);
      }
    });
  };

  const adjust = (draft: Draft, delta: number, reason: string) => {
    if (draft.stock_quantity + delta < 0) { setMessage('庫存不可低於 0。'); return; }
    setMessage('');
    void enqueue(draft.id, async () => { await api.adjustProductStock(draft.id, delta, reason); await onRefresh(); });
  };

  const openHistory = async (product: Draft) => {
    setDialog({ type: 'history', product }); setHistory([]); setMessage('');
    try { setHistory(await api.getProductStockHistory(product.id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : '無法載入補貨紀錄。'); }
  };
  const closeDialog = () => setDialog(undefined);
  const filtered = Object.values(drafts).filter(product => `${product.name} ${product.vendor_name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const onCellKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } };

  return <div className="products-view">
    <header className="products-header"><div><h2>產品資料維護</h2><p>欄位離開焦點或按 Enter 即儲存；所有庫存異動均保留紀錄。</p></div><button className="btn" onClick={() => setDialog({ type: 'create' })}><Plus size={18}/>新增產品</button></header>
    {message && <p className="settings-error" role="alert">{message}</p>}
    <label className="product-search"><Search size={20}/><span className="sr-only">搜尋產品</span><input placeholder="搜尋產品或廠商…" value={query} onChange={event => setQuery(event.target.value)}/></label>
    <div className="product-table-wrap card"><table className="product-table">
      <thead><tr><th>產品名稱</th><th>價格（NT$）</th><th>庫存</th><th>廠商</th><th>快速操作</th></tr></thead>
      <tbody>{filtered.map(draft => {
        const isSaving = saving.has(draft.id);
        return <tr key={draft.id} className={draft.active ? '' : 'product-inactive'}>
          <td data-label="產品名稱"><input aria-label={`${draft.name}產品名稱`} value={draft.name} onChange={event => updateDraft(draft.id, { name: event.target.value })} onBlur={() => saveDraft(draft)} onKeyDown={onCellKeyDown}/></td>
          <td data-label="價格（NT$）"><input aria-label={`${draft.name}價格`} type="number" min="0" step="1" value={draft.price} onChange={event => updateDraft(draft.id, { price: Number(event.target.value) })} onBlur={() => saveDraft(draft)} onKeyDown={onCellKeyDown}/></td>
          <td data-label="庫存"><div className="stock-editor"><button aria-label={`${draft.name}庫存減一`} disabled={isSaving || draft.stock_quantity < 1} onClick={() => adjust(draft, -1, '快速減少庫存') }><Minus size={17}/></button><input className={draft.stock_quantity < 5 ? 'low-stock' : ''} aria-label={`${draft.name}庫存`} type="number" min="0" step="1" value={draft.stock_quantity} onChange={event => updateDraft(draft.id, { stock_quantity: Number(event.target.value) })} onBlur={() => saveDraft(draft)} onKeyDown={onCellKeyDown}/><button aria-label={`${draft.name}庫存加一`} disabled={isSaving} onClick={() => adjust(draft, 1, '快速增加庫存')}><Plus size={17}/></button></div></td>
          <td data-label="廠商"><input aria-label={`${draft.name}廠商`} value={draft.vendor_name ?? ''} placeholder="自由輸入" onChange={event => updateDraft(draft.id, { vendor_name: event.target.value })} onBlur={() => saveDraft(draft)} onKeyDown={onCellKeyDown}/></td>
          <td data-label="快速操作"><div className="product-actions"><button disabled={isSaving} onClick={() => { setQuantity(10); setDialog({ type: 'restock', product: draft }); }}><PackagePlus size={17}/>補貨</button><button disabled={isSaving} onClick={() => { const next = { ...draft, active: draft.active ? 0 as const : 1 as const }; updateDraft(draft.id, next); saveDraft(next); }}>{draft.active ? '停用' : '啟用'}</button><button onClick={() => void openHistory(draft)}><History size={17}/>補貨紀錄</button><button className="danger-action" disabled={isSaving} onClick={() => setDialog({ type: 'delete', product: draft })}><Trash2 size={17}/>刪除</button>{isSaving && <span role="status">儲存中…</span>}</div></td>
        </tr>;
      })}</tbody>
    </table>{!filtered.length && <p className="product-empty">沒有符合條件的產品。</p>}</div>

    {dialog && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}><section className="card product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
      <button className="modal-close" aria-label="關閉" onClick={closeDialog}>×</button>
      {dialog.type === 'create' && <form onSubmit={async event => { event.preventDefault(); setMessage(''); try { await api.createProduct({ ...newProduct, vendor_name: newProduct.vendor_name.trim() || null, active: 1 }); setNewProduct({ name: '', price: 0, stock_quantity: 0, vendor_name: '' }); closeDialog(); await onRefresh(); } catch (error) { setMessage(error instanceof Error ? error.message : '新增產品失敗。'); } }}><h3 id="product-dialog-title">新增產品</h3><label>產品名稱<input autoFocus required value={newProduct.name} onChange={event => setNewProduct(value => ({ ...value, name: event.target.value }))}/></label><label>價格（NT$）<input required type="number" min="0" value={newProduct.price} onChange={event => setNewProduct(value => ({ ...value, price: Number(event.target.value) }))}/></label><label>初始庫存<input required type="number" min="0" value={newProduct.stock_quantity} onChange={event => setNewProduct(value => ({ ...value, stock_quantity: Number(event.target.value) }))}/></label><label>廠商<input value={newProduct.vendor_name} onChange={event => setNewProduct(value => ({ ...value, vendor_name: event.target.value }))}/></label><button className="btn">新增</button></form>}
      {dialog.type === 'restock' && <form onSubmit={event => { event.preventDefault(); if (!Number.isInteger(quantity) || quantity <= 0) { setMessage('進貨數量必須是大於 0 的整數。'); return; } adjust(dialog.product, quantity, '快速補貨'); closeDialog(); }}><h3 id="product-dialog-title">快速補貨 · {dialog.product.name}</h3><p>目前 {dialog.product.stock_quantity}，補貨後為 {dialog.product.stock_quantity + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0)}。</p><label>進貨數量<input autoFocus required type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))}/></label><button className="btn">確認補貨</button></form>}
      {dialog.type === 'delete' && <div><h3 id="product-dialog-title">確認刪除</h3><p>確定永久刪除「{dialog.product.name}」？已有訂單或庫存紀錄時，請改為停用。</p><div className="dialog-actions"><button className="btn btn-secondary" onClick={closeDialog}>取消</button><button className="btn danger-action" onClick={async () => { try { await api.deleteProduct(dialog.product.id); closeDialog(); await onRefresh(); } catch (error) { closeDialog(); setMessage(error instanceof Error ? error.message : '刪除產品失敗。'); } }}>確認刪除</button></div></div>}
      {dialog.type === 'history' && <div><h3 id="product-dialog-title">補貨紀錄 · {dialog.product.name}</h3><div className="history-list" aria-live="polite">{history.length ? history.map(item => <article key={item.id}><strong className={item.quantity_delta < 0 ? 'low-stock' : ''}>{item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta}</strong><span>結餘 {item.resulting_quantity} · {item.reason}</span><time dateTime={item.created_at}>{new Date(`${item.created_at.replace(' ', 'T')}Z`).toLocaleString('zh-TW')}</time></article>) : <p>尚無庫存異動紀錄。</p>}</div></div>}
    </section></div>}
  </div>;
}
