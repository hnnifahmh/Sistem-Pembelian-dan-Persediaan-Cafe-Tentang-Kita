const API_BASE = '/api';
const SUPABASE_URL = 'https://rroyyveevczoesfpucik.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qh7IZlvzHJZZn02lUQEExw_kuBg-RkR';
const supabaseHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
const rupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const dateText = value => value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-';
const state = { materials: [], suppliers: [], purchases: [], products: [] };

async function supabaseRequest(path, options = {}) { const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...options, headers: { ...supabaseHeaders, ...(options.headers || {}) } }); const data = response.status === 204 ? null : await response.json(); if (!response.ok) throw new Error(data.message || data.error_description || data.error || 'Permintaan Supabase gagal'); return data; }
async function directRequest(path, options = {}) {
	if (path === '/purchases' && options.method === 'POST') throw new Error('Backend belum aktif');
  const materialDelete = path.match(/^\/materials\/([^/]+)$/);
  if (materialDelete && options.method === 'DELETE') return supabaseRequest(`/materials?id=eq.${encodeURIComponent(decodeURIComponent(materialDelete[1]))}`, options);
	if (path === '/dashboard') {
		const [materials, purchases, products] = await Promise.all([
			supabaseRequest('/materials?select=*'),
			supabaseRequest('/purchases?select=*&order=purchase_date.desc,created_at.desc&limit=10'),
			supabaseRequest('/products?select=*')
		]);
		return { materials, purchases, products, inventoryValue: materials.reduce((total, material) => total + fifoValue(material), 0), lowStockCount: materials.filter(material => stockOf(material) <= Number(material.minimum_stock)).length };
	}
	if (path === '/suppliers') return supabaseRequest('/suppliers?select=*&order=name.asc', options);
	if (path === '/products') return supabaseRequest('/products?select=*&order=name.asc', options);
	if (path === '/purchases') return supabaseRequest('/purchases?select=*&order=purchase_date.desc,created_at.desc&limit=10', options);
	return supabaseRequest(path, options);
}
async function request(path, options) { try { const response = await fetch(`${API_BASE}${path}`, options); if (!response.ok) throw new Error('Backend belum aktif'); return await response.json(); } catch (error) { return directRequest(path, options); } }
function stockOf(material) { return material.current_stock ?? (material.fifo_layers || []).reduce((sum, layer) => sum + Number(layer.quantity || 0), 0); }
function fifoValue(material) { return (material.fifo_layers || []).reduce((sum, layer) => sum + Number(layer.quantity || 0) * Number(layer.unit_cost || 0), 0); }
function renderMaterials() {
  const body = document.querySelector('#materialsBody');
  const query = (document.querySelector('#dashboardSearch')?.value || '').trim().toLocaleLowerCase('id-ID');
  const materials = state.materials.filter(material => `${material.name} ${material.unit}`.toLocaleLowerCase('id-ID').includes(query));
  if (!materials.length) { body.innerHTML = '<tr><td colspan="6" class="empty">Belum ada bahan baku yang cocok.</td></tr>'; return; }
  body.innerHTML = materials.map((material, index) => {
    const stock = stockOf(material);
    const low = stock <= Number(material.minimum_stock);
    return `<tr><td>${index + 1}</td><td><div class="material-name">${material.name}</div><div class="material-sub">${material.fifo_layers?.length || 0} layer FIFO · ${rupiah(fifoValue(material))}</div></td><td class="${low ? 'stock-low' : 'stock-ok'}"><b>${stock.toLocaleString('id-ID')}</b></td><td>${Number(material.minimum_stock).toLocaleString('id-ID')} ${material.unit}</td><td><span class="status-pill ${low ? 'low' : ''}">${low ? 'Perlu perhatian' : 'Aman'}</span></td><td class="cell-actions"><button type="button" class="mini-button danger" data-delete-material-id="${material.id}" aria-label="Hapus bahan ${material.name}">Hapus</button></td></tr>`;
  }).join('');
}
function renderSelects() { document.querySelector('#supplierId').innerHTML = '<option value="">Pilih supplier</option>' + state.suppliers.map(item => `<option value="${item.id}">${item.name}</option>`).join(''); document.querySelector('#materialId').innerHTML = '<option value="">Pilih bahan</option>' + state.materials.map(item => `<option value="${item.id}">${item.name} (${item.unit})</option>`).join(''); }
function renderProducts() { const body = document.querySelector('#productsBody'); const query = (document.querySelector('#dashboardSearch')?.value || '').trim().toLocaleLowerCase('id-ID'); const products = state.products.filter(product => `${product.name} ${product.category}`.toLocaleLowerCase('id-ID').includes(query)); if (!products.length) { body.innerHTML = '<tr><td colspan="4" class="empty">Belum ada produk yang cocok.</td></tr>'; return; } body.innerHTML = products.map(product => {
  const recipeList = Array.isArray(product.recipe) ? product.recipe.map(item => {
    const materialName = item.material || item.name || 'Bahan';
    const quantity = Number(item.quantity || 0);
    return `<span class="ingredient-tag">${materialName} ${quantity}</span>`;
  }).join('') : '<span class="ingredient-tag">Tanpa recipe</span>';
  return `<tr><td><div class="material-name">${product.name}</div></td><td>${product.category}</td><td>${rupiah(product.selling_price)}</td><td><div class="ingredient-list">${recipeList}</div></td></tr>`;
}).join(''); }
function renderRecentActivity() {
  const list = document.querySelector('#activityList');
  if (!state.purchases.length) { list.innerHTML = '<div class="empty">Belum ada aktivitas pembelian.</div>'; return; }
  list.innerHTML = state.purchases.slice(0, 5).map(item => {
    const firstItem = item.items?.[0];
    const material = state.materials.find(entry => entry.id === firstItem?.material_id);
    const detail = material ? `${material.name} · ${Number(firstItem.quantity || 0).toLocaleString('id-ID')} ${material.unit}` : `${item.items?.length || 0} bahan dicatat`;
    return `<div class="activity-item"><span class="activity-badge purchase">＋</span><span class="activity-copy"><b>Pembelian bahan baku</b><small>${detail} · ${rupiah(item.total_amount)}</small></span><time class="activity-time">${dateText(item.purchase_date)}</time></div>`;
  }).join('');
}
function renderRecipeRows() {
  const container = document.querySelector('#recipeContainer');
  if (!container) return;
  const existing = [...container.querySelectorAll('[data-recipe-row]')];
  if (existing.length) return;
  const materialOptions = state.materials.length ? state.materials.map(material => `<option value="${material.name}">${material.name}</option>`).join('') : '<option value="">Belum ada bahan</option>';
  container.innerHTML = `
    <div class="recipe-row" data-recipe-row>
      <select class="recipe-material" data-material>
        <option value="">Pilih bahan</option>
        ${materialOptions}
      </select>
      <input class="recipe-qty" data-qty type="number" min="0.01" step="0.01" placeholder="Qty" />
      <button type="button" class="mini-button remove-recipe-row" aria-label="Hapus bahan">–</button>
    </div>
  `;
  container.querySelector('.remove-recipe-row').addEventListener('click', () => {
    container.innerHTML = '';
    renderRecipeRows();
  });
}
function addRecipeRow() {
  const container = document.querySelector('#recipeContainer');
  if (!container) return;
  const materialOptions = state.materials.length ? state.materials.map(material => `<option value="${material.name}">${material.name}</option>`).join('') : '<option value="">Belum ada bahan</option>';
  const row = document.createElement('div');
  row.className = 'recipe-row';
  row.dataset.recipeRow = 'true';
  row.innerHTML = `
    <select class="recipe-material" data-material>
      <option value="">Pilih bahan</option>
      ${materialOptions}
    </select>
    <input class="recipe-qty" data-qty type="number" min="0.01" step="0.01" placeholder="Qty" />
    <button type="button" class="mini-button remove-recipe-row" aria-label="Hapus bahan">–</button>
  `;
  row.querySelector('.remove-recipe-row').addEventListener('click', () => row.remove());
  container.appendChild(row);
}
function renderMetrics(dashboard) { document.querySelector('#inventoryValue').textContent = rupiah(dashboard.inventoryValue); document.querySelector('#lowStockCount').textContent = dashboard.lowStockCount; const total = state.purchases.reduce((sum, item) => sum + Number(item.total_amount || 0), 0); document.querySelector('#purchaseTotal').textContent = rupiah(total); document.querySelector('#purchaseCount').textContent = `${state.purchases.length} transaksi tercatat`; }
async function loadData() { document.querySelector('#materialsBody').classList.add('loading'); try {
  let dashboard = { materials: [], purchases: [], inventoryValue: 0, lowStockCount: 0 };
  let suppliers = [];
  let products = [];

  try { dashboard = await request('/dashboard'); } catch (error) { dashboard = { materials: [], purchases: [], inventoryValue: 0, lowStockCount: 0 }; }
  try { suppliers = await request('/suppliers'); } catch (error) { suppliers = []; }
  try { products = await request('/products'); } catch (error) { products = []; }

  state.materials = dashboard.materials || [];
  state.purchases = dashboard.purchases || [];
  state.suppliers = suppliers;
  state.products = products;
  renderRecipeRows();
  renderMaterials(); renderSelects(); renderProducts(); renderRecentActivity(); renderMetrics(dashboard);
} catch (error) { document.querySelector('#materialsBody').innerHTML = `<tr><td colspan="6" class="empty error">${error.message}</td></tr>`; } finally { document.querySelector('#materialsBody').classList.remove('loading'); } }
document.querySelector('#currentDateLabel').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
document.querySelector('#dashboardSearch').addEventListener('input', () => { renderMaterials(); renderProducts(); });
document.querySelector('#purchaseDate').valueAsDate = new Date();
document.querySelector('#refreshButton').addEventListener('click', loadData);
document.querySelector('#addRecipeRow').addEventListener('click', addRecipeRow);
document.querySelectorAll('[data-scroll]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.scroll).scrollIntoView({ behavior: 'smooth' })));
document.querySelector('#purchaseForm').addEventListener('submit', async event => { event.preventDefault(); const message = document.querySelector('#formMessage'); const button = event.target.querySelector('button[type="submit"]'); button.disabled = true; message.textContent = 'Menyimpan...'; try { const purchaseData = { supplier_id: document.querySelector('#supplierId').value, material_id: document.querySelector('#materialId').value, quantity: Number(document.querySelector('#quantity').value), unit_cost: Number(document.querySelector('#unitCost').value), purchase_date: document.querySelector('#purchaseDate').value }; try { await request('/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(purchaseData) }); } catch (error) { const materials = await supabaseRequest(`/materials?id=eq.${encodeURIComponent(purchaseData.material_id)}&select=*`); const material = materials[0]; if (!material) throw new Error('Bahan baku tidak ditemukan.'); const layers = [...(material.fifo_layers || []), { quantity: purchaseData.quantity, unit_cost: purchaseData.unit_cost, received_at: new Date().toISOString() }]; const stock = layers.reduce((total, layer) => total + Number(layer.quantity), 0); const total = purchaseData.quantity * purchaseData.unit_cost; await supabaseRequest(`/materials?id=eq.${encodeURIComponent(purchaseData.material_id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ fifo_layers: layers, current_stock: stock, updated_at: new Date().toISOString() }) }); await supabaseRequest('/purchases', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ supplier_id: purchaseData.supplier_id, purchase_date: purchaseData.purchase_date, total_amount: total, items: [{ material_id: purchaseData.material_id, quantity: purchaseData.quantity, unit_cost: purchaseData.unit_cost }], journal: [{ account: 'Persediaan Bahan Baku', debit: total, credit: 0 }, { account: 'Hutang Supplier Non-PKP', debit: 0, credit: total }] }) }); } message.textContent = 'Pembelian tersimpan dan layer FIFO ditambahkan.'; event.target.reset(); document.querySelector('#purchaseDate').valueAsDate = new Date(); await loadData(); } catch (error) { message.textContent = error.message; } finally { button.disabled = false; } });
document.querySelector('#productForm').addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.querySelector('#productMessage');
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  message.textContent = 'Menyimpan produk...';

  try {
    const rows = [...document.querySelectorAll('[data-recipe-row]')];
    const recipe = rows.map(row => {
      const material = row.querySelector('[data-material]').value;
      const quantity = Number(row.querySelector('[data-qty]').value || 0);
      if (!material || quantity <= 0) return null;
      return { material, quantity };
    }).filter(Boolean);

    if (!recipe.length) throw new Error('Pilih minimal satu bahan untuk recipe produk.');

    const payload = {
      name: document.querySelector('#productName').value.trim(),
      category: document.querySelector('#productCategory').value,
      selling_price: Number(document.querySelector('#productPrice').value),
      recipe,
      is_active: true
    };

    await request('/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    message.textContent = 'Produk baru berhasil disimpan.';
    event.target.reset();
    renderRecipeRows();
    await loadData();
  } catch (error) {
    message.textContent = error.message || 'Gagal menyimpan produk.';
  } finally {
    button.disabled = false;
  }
});
document.querySelector('#materialsBody').addEventListener('click', async event => {
  const trigger = event.target.closest('[data-delete-material-id]');
  if (!trigger) return;

  const id = trigger.dataset.deleteMaterialId;
  const material = state.materials.find(item => item.id === id);
  const materialName = material ? material.name : 'bahan baku';
  const confirmed = window.confirm(`Hapus ${materialName} dari persediaan? Tindakan ini akan menghapus data bahan baku yang salah.`);
  if (!confirmed) return;

  try {
    await request(`/materials/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadData();
  } catch (error) {
    alert(error.message || 'Gagal menghapus bahan baku.');
  }
});
loadData();
