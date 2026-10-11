const http = require('http');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = "https://rroyyveevczoesfpucik.supabase.co";
const SUPABASE_KEY = "sb_publishable_qh7IZlvzHJZZn02lUQEExw_kuBg-RkR";
const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
const frontendPath = path.join(__dirname, '..', 'frontend');

const demo = {
  suppliers: [{ id: 'demo-supplier', name: 'Supplier Demo', is_pkp: false }],
  materials: [
    { id: 'coffee', name: 'Biji kopi arabika', unit: 'kg', minimum_stock: 5, fifo_layers: [{ quantity: 8, unit_cost: 145000 }] },
    { id: 'milk', name: 'Susu full cream', unit: 'liter', minimum_stock: 12, fifo_layers: [{ quantity: 18, unit_cost: 21000 }] },
    { id: 'sugar', name: 'Gula aren', unit: 'kg', minimum_stock: 4, fifo_layers: [{ quantity: 3, unit_cost: 38000 }] },
    { id: 'cup', name: 'Cup  icon 16 oz', unit: 'pcs', minimum_stock: 100, fifo_layers: [{ quantity: 260, unit_cost: 850 }] }
  ],
  products: [
    { id: 'latte', name: 'Kopi Latte', category: 'minuman', selling_price: 25000, recipe: [{ material: 'Biji kopi arabika', quantity: 0.02 }, { material: 'Susu full cream', quantity: 0.12 }, { material: 'Gula aren', quantity: 0.01 }], is_active: true },
    { id: 'cappuccino', name: 'Cappuccino', category: 'minuman', selling_price: 28000, recipe: [{ material: 'Biji kopi arabika', quantity: 0.02 }, { material: 'Susu full cream', quantity: 0.14 }], is_active: true }
  ],
  purchases: []
};

function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' }); res.end(JSON.stringify(body)); }
async function supabase(table, options = {}) {
  if (!hasSupabase) return demo[table] || [];
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${options.query || ''}`, { method: options.method || 'GET', headers: { apikey: SUPABASE_KEY, Authorization: options.authorization || `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: options.method === 'POST' ? 'return=representation' : undefined }, body: options.body ? JSON.stringify(options.body) : undefined });
    const text = await response.text();
    if (!response.ok) {
      const message = text || 'request failed';
      if (message.includes('Could not find the table') || message.includes('PGRST205') || message.includes('does not exist')) return [];
      throw new Error(message);
    }
    return response.status === 204 ? null : JSON.parse(text || 'null');
  } catch (error) {
    const message = String(error.message || 'unknown');
    if (message.includes('Could not find the table') || message.includes('PGRST205') || message.includes('does not exist')) return [];
    throw error;
  }
}
function inventoryValue(materials) { return materials.reduce((total, item) => total + (item.fifo_layers || []).reduce((sum, layer) => sum + Number(layer.quantity) * Number(layer.unit_cost), 0), 0); }
function jsonBody(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', chunk => data += chunk); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (error) { reject(error); } }); }); }
function fifoAdd(layers, quantity, unitCost) { return [...(layers || []), { quantity: Number(quantity), unit_cost: Number(unitCost), received_at: new Date().toISOString() }]; }

function serveFrontend(req, res, pathname) {
  const requestedFile = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(frontendPath, requestedFile);
  if (!filePath.startsWith(path.resolve(frontendPath)) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

async function route(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && !url.pathname.startsWith('/api/') && serveFrontend(req, res, url.pathname)) return;
  try {
    if (req.method === 'GET' && url.pathname === '/api/materials') return send(res, 200, await supabase('materials', { query: '?select=*&order=name.asc' }));
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/materials/')) {
      const materialId = decodeURIComponent(url.pathname.slice('/api/materials/'.length));
      if (!materialId) return send(res, 400, { error: 'ID bahan baku wajib diisi.' });
      if (hasSupabase) await supabase('materials', { method: 'DELETE', query: `?id=eq.${encodeURIComponent(materialId)}`, authorization: req.headers.authorization });
      else demo.materials = demo.materials.filter(item => item.id !== materialId);
      return send(res, 200, { deleted: true, id: materialId });
    }
    if (req.method === 'GET' && url.pathname === '/api/suppliers') return send(res, 200, await supabase('suppliers', { query: '?select=*&order=name.asc' }));
    if (req.method === 'GET' && url.pathname === '/api/products') return send(res, 200, await supabase('products', { query: '?select=*&order=name.asc' }));
    if (req.method === 'GET' && url.pathname === '/api/purchases') return send(res, 200, await supabase('purchases', { query: '?select=*&order=purchase_date.desc,created_at.desc&limit=10' }));
    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const [materials, purchases, products] = await Promise.all([
        supabase('materials', { query: '?select=*' }),
        supabase('purchases', { query: '?select=*&order=purchase_date.desc&limit=10' }),
        supabase('products', { query: '?select=*' })
      ]);
      return send(res, 200, { materials, purchases, products, inventoryValue: inventoryValue(materials), lowStockCount: materials.filter(item => Number(item.current_stock ?? (item.fifo_layers || []).reduce((sum, layer) => sum + Number(layer.quantity), 0)) <= Number(item.minimum_stock)).length });
    }
    if (req.method === 'POST' && url.pathname === '/api/products') {
      const body = await jsonBody(req);
      if (!body.name || !body.selling_price || !Array.isArray(body.recipe)) return send(res, 400, { error: 'Nama produk, harga jual, dan recipe wajib diisi.' });
      const product = { name: body.name, category: body.category || 'minuman', selling_price: Number(body.selling_price), recipe: body.recipe, is_active: body.is_active !== false };
      if (hasSupabase) {
        const saved = await supabase('products', { method: 'POST', body: product, authorization: req.headers.authorization });
        return send(res, 201, Array.isArray(saved) ? saved[0] : saved);
      }
      demo.products.unshift({ id: `product-${Date.now()}`, ...product });
      return send(res, 201, demo.products[0]);
    }
    if (req.method === 'POST' && url.pathname === '/api/purchases') {
      const body = await jsonBody(req);
      if (!body.supplier_id || !body.material_id || !body.quantity || body.unit_cost < 0 || !body.purchase_date) return send(res, 400, { error: 'Supplier, bahan, jumlah, harga, dan tanggal wajib diisi.' });
      const materials = await supabase('materials', { query: `?id=eq.${encodeURIComponent(body.material_id)}&select=*` });
      const material = materials[0];
      if (!material) return send(res, 404, { error: 'Bahan baku tidak ditemukan.' });
      const nextLayers = fifoAdd(material.fifo_layers, body.quantity, body.unit_cost);
      const nextStock = nextLayers.reduce((sum, layer) => sum + Number(layer.quantity), 0);
      const purchase = { supplier_id: body.supplier_id, purchase_date: body.purchase_date, total_amount: Number(body.quantity) * Number(body.unit_cost), items: [{ material_id: body.material_id, quantity: Number(body.quantity), unit_cost: Number(body.unit_cost) }], journal: [{ account: 'Persediaan Bahan Baku', debit: Number(body.quantity) * Number(body.unit_cost), credit: 0 }, { account: 'Hutang Supplier Non-PKP', debit: 0, credit: Number(body.quantity) * Number(body.unit_cost) }] };
      if (hasSupabase) { await supabase('materials', { method: 'PATCH', query: `?id=eq.${encodeURIComponent(body.material_id)}`, body: { fifo_layers: nextLayers, current_stock: nextStock, updated_at: new Date().toISOString() }, authorization: req.headers.authorization }); const saved = await supabase('purchases', { method: 'POST', body: purchase, authorization: req.headers.authorization }); return send(res, 201, saved[0]); }
      material.fifo_layers = nextLayers; material.current_stock = nextStock; demo.purchases.unshift({ id: `demo-${Date.now()}`, ...purchase }); return send(res, 201, demo.purchases[0]);
    }
    send(res, 404, { error: 'Endpoint tidak ditemukan.' });
  } catch (error) { console.error(error); send(res, 500, { error: 'Terjadi kesalahan server.', detail: error.message }); }
}
http.createServer(route).listen(PORT, () => console.log(`Tentang Kita API berjalan di http://localhost:${PORT}`));
