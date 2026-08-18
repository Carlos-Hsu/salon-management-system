import React, { useState } from 'react';
import { Search, Plus, Edit, Trash2, Package } from 'lucide-react';
import { api, Product, Vendor } from '../api';

interface ProductsViewProps {
  products: Product[];
  vendors: Vendor[];
  onCreateProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (id: number) => Promise<void>;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ products, vendors, onCreateProduct, onUpdateProduct, onDeleteProduct }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // 表單狀態
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [vendorId, setVendorId] = useState<number | ''>('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setPrice(0);
    setStock(0);
    setVendorId('');
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setPrice(product.price);
    setStock(product.stock_quantity);
    setVendorId(product.vendor_id || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = { 
        name, 
        price, 
        stock_quantity: stock, 
        vendor_id: vendorId === '' ? null : vendorId 
      };
      
      if (editingProduct) {
        await onUpdateProduct({ ...editingProduct, ...productData });
      } else {
        await onCreateProduct(productData);
      }
      setShowModal(false);
    } catch (err) {
      alert(editingProduct ? '更新產品失敗' : '新增產品失敗');
    }
  };

  return (
    <div className="products-view" style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontWeight: 700 }}>產品資料維護</h2>
        <button className="btn" onClick={openAddModal}><Plus size={18} /> 新增產品</button>
      </div>

      <div className="card" style={{ marginBottom: '1rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Search size={20} />
        <input type="text" placeholder="搜尋產品名稱..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ border: 'none', outline: 'none', width: '100%' }} />
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>產品名稱</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>價格</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>庫存</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>廠商</th>
              <th style={{ textAlign: 'center', padding: '0.5rem' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                <td style={{ padding: '0.5rem' }}>{p.name}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>${p.price}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>{p.stock_quantity}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>{p.vendorName || '-'}</td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <button onClick={() => openEditModal(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', marginRight: '0.5rem' }}><Edit size={16} /></button>
                  <button onClick={() => onDeleteProduct(p.id!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f' }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem' }}>{editingProduct ? '編輯產品' : '新增產品'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>名稱</label>
                <input className="form-control" type="text" required value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>價格</label>
                <input className="form-control" type="number" required value={price} onChange={e => setPrice(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>庫存</label>
                <input className="form-control" type="number" required value={stock} onChange={e => setStock(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>廠商</label>
                <select className="form-control" value={vendorId} onChange={e => setVendorId(Number(e.target.value))}>
                  <option value="">請選擇廠商</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} style={{ flex: 1 }}>取消</button>
                <button className="btn" type="submit" style={{ flex: 1 }}>儲存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
