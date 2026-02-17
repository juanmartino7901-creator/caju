-- ============================================================
-- PAGOBOX — Seed Data
-- Run AFTER schema.sql
-- ============================================================

-- ============================================================
-- SUPPLIERS
-- ============================================================

INSERT INTO suppliers (name, alias, tax_id, category, bank_name, bank_code, account_type, account_number, account_currency, phone, email, contact_name, payment_terms, notes) VALUES
('Distribuidora del Este S.A.', 'Dist. Este', '21.234.567.0001', 'Insumos', 'Itaú', '113', 'CC', '1234567', 'UYU', '2604 5678', 'ventas@disteste.com.uy', 'María López', '30 días', ''),
('Frigorífico Nacional S.A.', 'Frigo Nacional', '21.098.765.0001', 'Carnes', 'BROU', '1', 'CA', '9876543210', 'UYU', '2908 1234', 'pagos@frigonal.com.uy', 'Carlos Pérez', '15 días', 'Descuento 2% pago contado'),
('Panadería La Rica', 'Pan La Rica', '21.555.333.0001', 'Panificados', 'Itaú', '113', 'CC', '7654321', 'UYU', '099 123 456', 'larica@gmail.com', 'Roberto Silva', 'Contado', ''),
('Envases Uruguay S.A.', 'Envases UY', '21.777.888.0001', 'Packaging', 'Santander', '137', 'CC', '456789012345', 'UYU', '2707 9988', 'compras@envaseuy.com.uy', 'Ana García', '30 días', ''),
('Transporte Rápido SRL', 'Transp Rápido', '21.444.222.0001', 'Logística', 'Itaú', '113', 'CA', '3456789', 'UYU', '099 876 543', 'admin@transporterapido.uy', 'Diego Martínez', '15 días', ''),
('Limpieza Total S.A.', 'Limp Total', '21.666.999.0001', 'Servicios', 'BROU', '1', 'CC', '1122334455', 'UYU', '2901 4455', 'contacto@limpiezatotal.uy', 'Laura Fernández', 'Contado', ''),
('Inmobiliaria Punta', 'Inmob Punta', '21.321.654.0001', 'Alquiler', 'Itaú', '113', 'CC', '9988776', 'UYU', '2710 3344', 'cobros@inmobpunta.com.uy', 'Fabiana Rodríguez', 'Mensual', 'Contrato hasta Dic 2027'),
('UTE', 'UTE', '21.100.100.0001', 'Servicios', 'BROU', '1', NULL, NULL, 'UYU', '0800 1930', NULL, NULL, 'Mensual', 'Pago por Abitab/Red Pagos'),
('OSE', 'OSE', '21.200.200.0001', 'Servicios', 'BROU', '1', NULL, NULL, 'UYU', '0800 1871', NULL, NULL, 'Mensual', ''),
('BSE', 'BSE Seguros', '21.300.300.0001', 'Seguros', 'BROU', '1', 'CC', '5566778899', 'UYU', '1998', NULL, NULL, 'Mensual', 'Póliza incendio + robo'),
('Antel', 'Antel', '21.400.400.0001', 'Servicios', 'BROU', '1', NULL, NULL, 'UYU', '*611', NULL, NULL, 'Mensual', 'Internet + Telefonía');

-- ============================================================
-- RECURRING EXPENSES
-- ============================================================

-- Get supplier IDs for linking
DO $$
DECLARE
  inmob_id UUID;
  ute_id UUID;
  ose_id UUID;
  bse_id UUID;
  antel_id UUID;
BEGIN
  SELECT id INTO inmob_id FROM suppliers WHERE alias = 'Inmob Punta' LIMIT 1;
  SELECT id INTO ute_id FROM suppliers WHERE alias = 'UTE' LIMIT 1;
  SELECT id INTO ose_id FROM suppliers WHERE alias = 'OSE' LIMIT 1;
  SELECT id INTO bse_id FROM suppliers WHERE alias = 'BSE Seguros' LIMIT 1;
  SELECT id INTO antel_id FROM suppliers WHERE alias = 'Antel' LIMIT 1;

  -- Costos Fijos
  INSERT INTO recurring_expenses (type, name, estimated_amount, currency, day_of_month, category, supplier_id, is_variable) VALUES
  ('fixed_cost', 'Alquiler Local', 85000, 'UYU', 5, 'Alquiler', inmob_id, false),
  ('fixed_cost', 'UTE (Electricidad)', 18000, 'UYU', 15, 'Servicios', ute_id, true),
  ('fixed_cost', 'OSE (Agua)', 4500, 'UYU', 20, 'Servicios', ose_id, true),
  ('fixed_cost', 'IMM (Tributo Municipal)', 3200, 'UYU', 10, 'Impuestos', NULL, false),
  ('fixed_cost', 'Seguro Local', 12000, 'UYU', 1, 'Seguros', bse_id, false),
  ('fixed_cost', 'Antel Internet+Tel', 3500, 'UYU', 12, 'Servicios', antel_id, false),
  ('fixed_cost', 'Software POS', 2500, 'UYU', 1, 'Suscripciones', NULL, false);

  -- Retiro Socio
  INSERT INTO recurring_expenses (type, name, estimated_amount, currency, day_of_month, category) VALUES
  ('owner_withdrawal', 'Retiro Juan', 120000, 'UYU', 25, 'Retiro');

  -- Cuotas Tarjeta
  INSERT INTO recurring_expenses (type, name, estimated_amount, currency, day_of_month, category, total_installments, current_installment, credit_card_last4, original_description, original_purchase_date) VALUES
  ('installment', 'Horno Industrial', 15000, 'UYU', 8, 'Tarjeta', 12, 5, '4521', 'Horno Industrial Venancio', '2025-09-15'),
  ('installment', 'Cámara Frigorífica', 22000, 'UYU', 8, 'Tarjeta', 18, 3, '4521', 'Cámara Frío Industrial 3x2m', '2025-11-20'),
  ('installment', 'Mostrador Exhibidor', 8500, 'UYU', 8, 'Tarjeta', 6, 4, '7832', 'Mostrador refrigerado exhibidor', '2025-10-05');

END $$;
