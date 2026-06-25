
-- Suppliers (marketplace, publicly browsable)
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  phone text,
  email text,
  city text,
  logo_url text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.suppliers TO anon, authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers are public read" ON public.suppliers FOR SELECT USING (active = true);

-- Supplier products
CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  price numeric(12,2) NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplier_products TO anon, authenticated;
GRANT ALL ON public.supplier_products TO service_role;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supplier products public read" ON public.supplier_products FOR SELECT USING (true);
CREATE INDEX idx_supplier_products_category ON public.supplier_products(category);
CREATE INDEX idx_supplier_products_supplier ON public.supplier_products(supplier_id);

-- Favorites (per partner)
CREATE TABLE public.supplier_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplier_id)
);
GRANT SELECT, INSERT, DELETE ON public.supplier_favorites TO authenticated;
GRANT ALL ON public.supplier_favorites TO service_role;
ALTER TABLE public.supplier_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own favorites" ON public.supplier_favorites
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Quote requests
CREATE TABLE public.quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity numeric(12,2) NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  message text,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_requests TO authenticated;
GRANT ALL ON public.quote_requests TO service_role;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own quotes" ON public.quote_requests
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Purchase orders (tracking for savings dashboard)
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity numeric(12,2) NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  unit_price numeric(12,2) NOT NULL,
  reference_price numeric(12,2),
  total numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own purchases" ON public.purchase_orders
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER tg_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_supplier_products_updated BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_quote_requests_updated BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed marketplace with a few suppliers per category for the MVP
INSERT INTO public.suppliers (name, category, phone, email, city, description) VALUES
  ('Frigorífico Boi Bom', 'Carnes', '11999990001', 'vendas@boibom.com.br', 'São Paulo', 'Cortes nobres e atacado para restaurantes'),
  ('Casa de Carnes Premium', 'Carnes', '11999990002', 'contato@ccpremium.com.br', 'Campinas', 'Bovinos, suínos e aves'),
  ('Distribuidora Bebidas Já', 'Bebidas', '11999990003', 'pedidos@bebidasja.com.br', 'São Paulo', 'Refrigerantes, sucos e cervejas'),
  ('Atacadão das Bebidas', 'Bebidas', '11999990004', 'sac@atacadaobebidas.com.br', 'Guarulhos', 'Distribuidor oficial multimarcas'),
  ('EmbalaPack', 'Embalagens', '11999990005', 'comercial@embalapack.com.br', 'São Paulo', 'Caixas, sacolas e descartáveis'),
  ('Pack Delivery', 'Embalagens', '11999990006', 'vendas@packdelivery.com.br', 'Osasco', 'Especialista em delivery'),
  ('Hortifruti Central', 'Hortifruti', '11999990007', 'contato@hortifruticentral.com.br', 'São Paulo', 'Verduras e frutas frescas'),
  ('Verde Fresh', 'Hortifruti', '11999990008', 'vendas@verdefresh.com.br', 'Santo André', 'Orgânicos e convencionais'),
  ('Limpa Tudo Pro', 'Limpeza', '11999990009', 'sac@limpatudopro.com.br', 'São Paulo', 'Produtos profissionais de limpeza'),
  ('Frio Total Congelados', 'Congelados', '11999990010', 'vendas@friototal.com.br', 'São Paulo', 'Linha completa de congelados'),
  ('Doce Vida Sobremesas', 'Sobremesas', '11999990011', 'contato@docevida.com.br', 'São Paulo', 'Doces, tortas e sorvetes industriais');

-- Seed products
WITH s AS (SELECT id, name FROM public.suppliers)
INSERT INTO public.supplier_products (supplier_id, name, category, price, unit)
SELECT s.id, p.name, p.category, p.price, p.unit FROM s
JOIN (VALUES
  ('Frigorífico Boi Bom','Picanha Bovina','Carnes',79.90,'kg'),
  ('Frigorífico Boi Bom','Hambúrguer 150g (cx 20)','Carnes',129.00,'cx'),
  ('Casa de Carnes Premium','Picanha Bovina','Carnes',74.50,'kg'),
  ('Casa de Carnes Premium','Frango Inteiro','Carnes',14.90,'kg'),
  ('Distribuidora Bebidas Já','Coca-Cola 2L (fardo 6un)','Bebidas',62.40,'fd'),
  ('Distribuidora Bebidas Já','Heineken 600ml (cx 12)','Bebidas',119.00,'cx'),
  ('Atacadão das Bebidas','Coca-Cola 2L (fardo 6un)','Bebidas',58.90,'fd'),
  ('Atacadão das Bebidas','Suco Del Valle 1L (cx 12)','Bebidas',74.50,'cx'),
  ('EmbalaPack','Caixa Pizza 35cm (100un)','Embalagens',89.00,'pct'),
  ('EmbalaPack','Sacola Delivery G (100un)','Embalagens',34.50,'pct'),
  ('Pack Delivery','Caixa Pizza 35cm (100un)','Embalagens',79.90,'pct'),
  ('Pack Delivery','Marmita Isopor 750ml (100un)','Embalagens',54.00,'pct'),
  ('Hortifruti Central','Tomate Italiano','Hortifruti',8.90,'kg'),
  ('Hortifruti Central','Alface Crespa','Hortifruti',3.50,'un'),
  ('Verde Fresh','Tomate Italiano','Hortifruti',7.50,'kg'),
  ('Verde Fresh','Cebola','Hortifruti',5.20,'kg'),
  ('Limpa Tudo Pro','Detergente 5L','Limpeza',38.00,'gl'),
  ('Limpa Tudo Pro','Desinfetante 5L','Limpeza',29.00,'gl'),
  ('Frio Total Congelados','Batata Pré-Frita (cx 10kg)','Congelados',119.00,'cx'),
  ('Frio Total Congelados','Mussarela Ralada (cx 10kg)','Congelados',289.00,'cx'),
  ('Doce Vida Sobremesas','Petit Gâteau (cx 12un)','Sobremesas',74.00,'cx'),
  ('Doce Vida Sobremesas','Sorvete Baunilha 10L','Sobremesas',119.00,'pt')
) AS p(supplier_name, name, category, price, unit) ON s.name = p.supplier_name;
