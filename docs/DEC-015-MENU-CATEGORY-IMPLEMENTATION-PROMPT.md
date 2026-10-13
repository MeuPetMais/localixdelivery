# Prompt de execução — DEC-015 / Hierarquia de Categorias

Projeto: Localix Delivery

Implemente a DEC-015 — Hierarquia de Categorias no Cardápio em fases controladas.

## Regras obrigatórias

1. Consulte `docs/DEC-015-MENU-CATEGORY-HIERARCHY.md` antes de alterar código.
2. Não refatore Checkout, OrderService, PricingEngine, PaymentService, Mercado Pago ou Localix Benefits.
3. Preserve `menu_items.category_id` como vínculo canônico.
4. Preserve todas as categorias e produtos existentes.
5. Suporte apenas 2 níveis:
   - categoria principal;
   - subcategoria.
6. Não permita:
   - self-parent;
   - subcategoria de subcategoria;
   - pai de outro restaurante.
7. Não aplique cascade que exclua produtos.
8. Revise a RLS pública de `menu_categories`: categoria-mãe deve continuar visível se houver item público elegível em qualquer subcategoria filha.
9. Foto e descrição ficam apenas na categoria principal nesta fase.
10. Não considerar concluído sem testes, build, migration, RLS, staging, produção e rollback.

## CAT-1 — Schema

Audite antes de criar migration.

Migration mínima:
- `parent_category_id uuid null`;
- `image_url text null`;
- `description text null`;
- FK/constraints necessárias.

Use constraint ou trigger server-side para garantir os limites de hierarquia e tenant.

Valide:
- categorias existentes continuam `parent_category_id IS NULL`;
- contagem antes/depois idêntica;
- vínculos de `menu_items.category_id` inalterados.

## CAT-2 — Painel

Em `src/routes/_authenticated/menu.tsx`:
- permitir imagem e descrição na categoria principal;
- criar e gerenciar subcategorias;
- seletor hierárquico no produto;
- manter fallback para categoria plana;
- não duplicar lógica desnecessariamente.

## CAT-3 — Cardápio público

Em `src/routes/$slug.index.tsx` e dependências:
- renderizar categoria principal com foto/nome/descrição;
- renderizar subcategorias quando existirem;
- manter comportamento atual sem subcategorias.

## CAT-4 — Validação

Testar:
- categoria principal sem subcategoria;
- categoria principal com 2 subcategorias;
- produto direto na principal;
- produto na subcategoria;
- terceiro nível bloqueado;
- cross-tenant bloqueado;
- policy pública;
- exclusão segura;
- checkout com produto de subcategoria;
- build e previews Vercel.

Resultado esperado:
PASS TÉCNICO somente após todas as evidências.
Se algo não puder ser comprovado, registrar exatamente:
**“Não foi possível provar.”**
