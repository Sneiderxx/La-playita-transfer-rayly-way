-- Enum para categorías de gastos fijos
CREATE TYPE fixed_cost_category AS ENUM ('luz', 'agua', 'internet', 'local', 'basura', 'personal', 'otro');

-- Tabla de gastos fijos mensuales
CREATE TABLE fixed_costs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category fixed_cost_category NOT NULL,
  monthly_amount NUMERIC(12,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla de facturas de compra de inventario
CREATE TABLE inventory_purchases (
  id SERIAL PRIMARY KEY,
  supplier VARCHAR(160),
  purchase_date DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Items de cada factura
CREATE TABLE inventory_purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES inventory_purchases(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  quantity NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(12,2) NOT NULL
);
