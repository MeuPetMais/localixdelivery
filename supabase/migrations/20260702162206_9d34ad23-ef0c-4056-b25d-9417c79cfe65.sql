
DO $$ BEGIN
  CREATE TYPE public.support_status AS ENUM ('aberto','em_analise','respondido','resolvido','fechado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_priority AS ENUM ('baixa','media','alta','urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_category AS ENUM (
    'problema_tecnico','pedido','pagamentos','cardapio','builder',
    'impressao','financeiro','fidelidade','ia','sugestao','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_number INTEGER,
  subject TEXT NOT NULL,
  category public.support_category NOT NULL DEFAULT 'outro',
  priority public.support_priority NOT NULL DEFAULT 'media',
  status public.support_status NOT NULL DEFAULT 'aberto',
  description TEXT NOT NULL,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "owners create own tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owners update own tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "admins delete tickets" ON public.support_tickets
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX support_tickets_restaurant_idx ON public.support_tickets(restaurant_id, created_at DESC);
CREATE INDEX support_tickets_user_idx ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX support_tickets_status_idx ON public.support_tickets(status);

CREATE OR REPLACE FUNCTION public.assign_support_ticket_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nxt INT;
BEGIN
  IF NEW.ticket_number IS NULL THEN
    SELECT COALESCE(MAX(ticket_number),1000)+1 INTO nxt
    FROM public.support_tickets WHERE restaurant_id = NEW.restaurant_id;
    NEW.ticket_number := nxt;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER support_tickets_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.assign_support_ticket_number();

CREATE TRIGGER support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL DEFAULT 'cliente' CHECK (author_type IN ('cliente','suporte')),
  body TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  read_by_owner BOOLEAN NOT NULL DEFAULT false,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read ticket messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(),'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.support_tickets t
               WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

CREATE POLICY "insert ticket messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND (
      private.has_role(auth.uid(),'admin'::public.app_role)
      OR EXISTS (SELECT 1 FROM public.support_tickets t
                 WHERE t.id = ticket_id AND t.user_id = auth.uid())
    )
  );

CREATE POLICY "mark messages read" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(),'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.support_tickets t
               WHERE t.id = ticket_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    private.has_role(auth.uid(),'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.support_tickets t
               WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

CREATE INDEX support_messages_ticket_idx ON public.support_messages(ticket_id, created_at);

CREATE OR REPLACE FUNCTION public.tg_support_message_bump()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_tickets
     SET last_message_at = NEW.created_at,
         updated_at = now(),
         status = CASE
           WHEN NEW.author_type = 'suporte' AND status IN ('aberto','em_analise') THEN 'respondido'::public.support_status
           WHEN NEW.author_type = 'cliente' AND status = 'respondido' THEN 'em_analise'::public.support_status
           ELSE status
         END
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER support_messages_bump
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_message_bump();

CREATE TABLE public.support_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  video_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.support_articles TO authenticated, anon;
GRANT ALL ON public.support_articles TO service_role;

ALTER TABLE public.support_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read published articles" ON public.support_articles
  FOR SELECT USING (published = true OR private.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "admins manage articles" ON public.support_articles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER support_articles_updated
  BEFORE UPDATE ON public.support_articles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

INSERT INTO public.support_articles (category, title, content, video_url, position) VALUES
('Primeiros passos','Bem-vindo ao Localix','Configure seu estabelecimento em 5 minutos: cadastre o perfil, adicione categorias, publique produtos e compartilhe o link com seus clientes.',NULL,1),
('Cardápio','Como cadastrar produtos','Acesse Cardápio → Adicionar produto. Preencha nome, preço, categoria e imagens. Use "Em destaque" para colocar o item no topo.',NULL,2),
('Builder','Como usar o Monte do Seu Jeito','Crie um builder, defina grupos (Tamanho, Sabores, Adicionais) e opções com preços. O cliente monta e o preço é calculado automaticamente.',NULL,3),
('Promoções','Como criar uma promoção','Vá em Promoções → Nova. Defina preço promocional, período e recorrência (ex.: Happy Hour). Aparece no topo do cardápio.',NULL,4),
('Pedidos','Fluxo dos pedidos','Novos pedidos entram em Pedidos. Arraste entre as colunas (Novo → Preparo → Entrega → Finalizado) ou use atalhos A/P/S/F.',NULL,5),
('Impressão','Configurar impressora','Em Impressão escolha o tamanho (58mm, 80mm ou A4) e o modelo (Cozinha/Cupom). Ative a impressão automática se desejar.',NULL,6),
('Financeiro','Controle financeiro','Registre receitas, despesas e custos em Financeiro. O Relatórios (Financeiro IA) calcula lucro estimado por período.',NULL,7),
('IA','Central de IA','A Central de IA analisa seus dados e sugere ações de marketing, recuperação de clientes VIP e ajustes de preço.',NULL,8);
