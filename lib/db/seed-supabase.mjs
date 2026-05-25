import pkg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pkg;

const SUPABASE_URL = process.env.SUPABASE_DATABASE_URL;
if (!SUPABASE_URL) throw new Error('SUPABASE_DATABASE_URL not set');

const pool = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } });

const hash = await bcrypt.hash('demo1234', 10);

// Tenant
let tenantId;
const tenantRes = await pool.query(`
  INSERT INTO tenants (name, slug, currency, timezone)
  VALUES ('Demo Store', 'demo-store', 'USD', 'America/New_York')
  ON CONFLICT DO NOTHING RETURNING id
`);
if (tenantRes.rows[0]) {
  tenantId = tenantRes.rows[0].id;
} else {
  const t = await pool.query("SELECT id FROM tenants WHERE name='Demo Store' LIMIT 1");
  tenantId = t.rows[0].id;
}
console.log('Tenant:', tenantId);

// Users
await pool.query(`
  INSERT INTO users (tenant_id, name, email, password_hash, role)
  VALUES
    ($1, 'Admin User', 'admin@demo.com', $2, 'admin'),
    ($1, 'Cashier User', 'cashier@demo.com', $2, 'cashier')
  ON CONFLICT (email) DO NOTHING
`, [tenantId, hash]);
console.log('Users seeded');

// Categories
const catRes = await pool.query(`
  INSERT INTO categories (tenant_id, name, color)
  VALUES
    ($1, 'Beverages', '#3B82F6'),
    ($1, 'Snacks', '#F59E0B'),
    ($1, 'Electronics', '#10B981')
  ON CONFLICT DO NOTHING RETURNING id, name
`, [tenantId]);
let cats = catRes.rows;
if (!cats.length) {
  const c = await pool.query('SELECT id, name FROM categories WHERE tenant_id=$1', [tenantId]);
  cats = c.rows;
}
const bevId = cats.find(c => c.name === 'Beverages')?.id;
const snkId = cats.find(c => c.name === 'Snacks')?.id;
const elcId = cats.find(c => c.name === 'Electronics')?.id;
console.log('Categories:', cats.map(c => c.name).join(', '));

// Products - check if any exist first
const existingProducts = await pool.query('SELECT COUNT(*) FROM products WHERE tenant_id=$1', [tenantId]);
if (parseInt(existingProducts.rows[0].count) === 0) {
  await pool.query(`
    INSERT INTO products (tenant_id, category_id, name, price, stock, sku)
    VALUES
      ($1, $2, 'Espresso', 3.50, 100, 'BEV-001'),
      ($1, $2, 'Cappuccino', 4.50, 80, 'BEV-002'),
      ($1, $2, 'Green Tea', 2.75, 60, 'BEV-003'),
      ($1, $3, 'Potato Chips', 1.99, 150, 'SNK-001'),
      ($1, $3, 'Granola Bar', 2.49, 5, 'SNK-002'),
      ($1, $4, 'USB Cable', 9.99, 30, 'ELC-001'),
      ($1, $4, 'Phone Stand', 14.99, 8, 'ELC-002')
  `, [tenantId, bevId, snkId, elcId]);
}
console.log('Products seeded');

// Orders
const adminRes = await pool.query("SELECT id FROM users WHERE email='admin@demo.com' LIMIT 1");
const adminId = adminRes.rows[0]?.id;
const existingOrders = await pool.query('SELECT COUNT(*) FROM orders WHERE tenant_id=$1', [tenantId]);
if (parseInt(existingOrders.rows[0].count) === 0) {
  // Get product IDs for correct item format
  const prods = await pool.query('SELECT id, name, price FROM products WHERE tenant_id=$1', [tenantId]);
  const p = {};
  for (const r of prods.rows) p[r.name] = { id: r.id, price: parseFloat(r.price) };

  const items1 = JSON.stringify([{ productId: p['Espresso']?.id, productName: 'Espresso', quantity: 2, unitPrice: 3.50, subtotal: 7.00 }]);
  const items2 = JSON.stringify([{ productId: p['Cappuccino']?.id, productName: 'Cappuccino', quantity: 1, unitPrice: 4.50, subtotal: 4.50 }, { productId: p['Granola Bar']?.id, productName: 'Granola Bar', quantity: 2, unitPrice: 2.49, subtotal: 4.98 }]);
  const items3 = JSON.stringify([{ productId: p['USB Cable']?.id, productName: 'USB Cable', quantity: 1, unitPrice: 9.99, subtotal: 9.99 }]);
  const items4 = JSON.stringify([{ productId: p['Green Tea']?.id, productName: 'Green Tea', quantity: 3, unitPrice: 2.75, subtotal: 8.25 }]);

  await pool.query(`
    INSERT INTO orders (tenant_id, cashier_id, order_number, status, items, subtotal, tax, total, payment_method)
    VALUES
      ($1, $2, 'ORD-0001', 'completed', $3, 7.00, 0.56, 7.56, 'cash'),
      ($1, $2, 'ORD-0002', 'completed', $4, 9.48, 0.76, 10.24, 'card'),
      ($1, $2, 'ORD-0003', 'pending',   $5, 9.99, 0.80, 10.79, 'cash'),
      ($1, $2, 'ORD-0004', 'completed', $6, 8.25, 0.66, 8.91, 'card')
  `, [tenantId, adminId, items1, items2, items3, items4]);
}
console.log('Orders seeded');

await pool.end();
console.log('Done! Supabase database seeded successfully.');
