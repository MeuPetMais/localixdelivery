# DEC-015 — Hierarquia de categorias no cardápio

- **Data:** 2026-10-13
- **Status:** IMPLEMENTADA — VALIDADA E2E
- **Escopo:** Cardápio / Catálogo / Painel do Parceiro / Vitrine pública
- **Tipo:** Decisão estrutural de produto e catálogo

## 1. Problema

O cardápio atual trabalha com categorias planas. O parceiro consegue organizar produtos em categorias, mas não dispõe de:
- subcategorias;
- imagem de capa da categoria principal;
- descrição breve da categoria principal;
- hierarquia visual que facilite a navegação em cardápios extensos.

Isso reduz a clareza para estabelecimentos com muitos produtos, especialmente pizzarias, hamburguerias, restaurantes e operações com múltiplas linhas de produto.

## 2. Contexto comprovado

O schema atual em produção usa:
- `public.menu_categories` com `id`, `restaurant_id`, `name`, `position`, `created_at`;
- `public.menu_items.category_id` como vínculo do produto com a categoria;
- RLS de escrita limitada ao owner do restaurante;
- policy pública de leitura de categorias condicionada à existência de item ativo ligado diretamente à categoria.

O painel atual consulta categorias diretamente de `menu_categories` e agrupa produtos por `menu_items.category_id`.

O Documento Mestre já define categorias, produtos, descrições e fotos como parte do domínio do cardápio e estabelece a navegação pública por categorias e produtos.

## 3. Opções consideradas

### Opção A — Criar tabela separada `menu_subcategories`
**Rejeitada.**

Criaria dois modelos paralelos para categorias e aumentaria complexidade de consultas, ordenação, RLS e manutenção.

### Opção B — Tornar `menu_categories` uma árvore ilimitada
**Rejeitada nesta fase.**

Aumentaria complexidade sem necessidade comprovada e permitiria profundidades difíceis de administrar no painel e na vitrine.

### Opção C — Reutilizar `menu_categories` com auto-relacionamento de até 2 níveis
**Aprovada.**

A própria tabela passa a representar:
- categoria principal: `parent_category_id IS NULL`;
- subcategoria: `parent_category_id = <categoria principal>`.

## 4. Decisão

### 4.1 Hierarquia máxima
O cardápio terá no máximo **2 níveis**:

```text
Categoria principal
└── Subcategoria
    └── Produtos
```

Não será permitida subcategoria de subcategoria.

### 4.2 Categoria principal
A categoria principal deverá suportar:
- nome;
- imagem;
- descrição breve;
- posição/ordem;
- status ativo/inativo, se o modelo técnico adotar essa flag;
- subcategorias opcionais.

### 4.3 Subcategoria
A subcategoria deverá suportar:
- nome;
- categoria principal;
- posição/ordem;
- status ativo/inativo, se adotado.

Imagem e descrição de subcategoria ficam fora do escopo inicial.

### 4.4 Associação de produtos
Regra de compatibilidade:

- se a categoria principal não possuir subcategorias, produtos podem continuar ligados diretamente a ela;
- se houver subcategorias, novos produtos deverão preferencialmente ser associados à subcategoria;
- produtos já existentes não serão migrados automaticamente para subcategorias;
- `menu_items.category_id` permanece como vínculo canônico do produto com a categoria.

### 4.5 Compatibilidade retroativa
Todas as categorias existentes serão tratadas como categorias principais:

```text
parent_category_id = NULL
```

Nenhum produto existente deve perder categoria durante a migration.

### 4.6 Vitrine pública
A categoria principal deverá ser apresentada com:
- imagem;
- nome;
- descrição breve.

Quando houver subcategorias, a vitrine deverá organizar os produtos dentro delas.

Categorias antigas sem imagem, descrição ou subcategoria devem continuar renderizando normalmente.

### 4.7 Painel do parceiro
O painel deverá permitir:
- criar categoria principal;
- editar nome, imagem, descrição e posição;
- criar subcategoria dentro de uma categoria principal;
- editar/remover subcategoria;
- selecionar categoria/subcategoria ao cadastrar ou editar produto;
- preservar fluxo atual para categorias sem subcategoria.

## 5. Regra de segurança e RLS

O isolamento por `restaurant_id` permanece obrigatório.

Uma subcategoria:
- só pode apontar para categoria principal do mesmo restaurante;
- não pode apontar para si mesma;
- não pode apontar para outra subcategoria.

A policy pública atual de categorias precisa ser revisada porque hoje exige item ativo diretamente ligado à categoria. Para categoria principal com produtos apenas nas subcategorias, a policy deve considerar itens ativos nas categorias filhas.

## 6. Impacto técnico

### Componentes afetados
- `menu_categories`;
- `menu_items.category_id`;
- painel `/menu`;
- vitrine pública `/{slug}`;
- queries públicas de categorias;
- RLS de categorias;
- tipagens do Supabase, quando aplicável;
- storage/upload de imagem de categoria.

### Componentes que não devem ser alterados por esta decisão
- Checkout;
- OrderService;
- PricingEngine;
- PaymentService;
- Mercado Pago;
- split;
- taxa de serviço;
- Localix Benefits;
- state machine do pedido.

A categoria é metadado de catálogo. O preço autoritativo do produto continua independente da hierarquia.

## 7. Modelo técnico mínimo aprovado

Adicionar em `menu_categories`:

- `parent_category_id uuid null` → FK para `menu_categories(id)`;
- `image_url text null`;
- `description text null`;
- opcionalmente `is_active boolean not null default true`, somente se a auditoria de implementação comprovar necessidade.

Também deverão existir constraints server-side para:
- impedir auto-parent;
- impedir terceiro nível;
- impedir vínculo entre restaurantes diferentes.

## 8. Riscos

### Médio
- policy pública esconder categoria-mãe sem item direto;
- inconsistência tenant se FK permitir pai de outro restaurante;
- regressão na renderização do cardápio antigo;
- exclusão de categoria principal com filhos;
- produto ficar órfão ao remover subcategoria sem estratégia explícita.

### Baixo
- impacto em checkout ou pagamento, desde que `menu_items.id`, preço e snapshot financeiro não sejam alterados.

## 9. Estratégia de rollout

### Gate CAT-1 — Schema e compatibilidade
- migration aditiva;
- constraints;
- RLS;
- categorias atuais preservadas;
- sem mudança visual obrigatória.

### Gate CAT-2 — Painel do parceiro
- edição da categoria principal;
- imagem;
- descrição;
- criação/edição de subcategorias;
- seleção hierárquica no produto.

### Gate CAT-3 — Vitrine pública
- categoria visual;
- subcategorias;
- fallback para categorias antigas.

### Gate CAT-4 — Validação E2E
- criar/editar/excluir categoria e subcategoria;
- produto em categoria principal;
- produto em subcategoria;
- tenant isolation;
- item público visível;
- checkout de produto permanece íntegro;
- build staging/production;
- rollback documentado.

## 10. Condição para revisão

Revisar esta decisão se:
- houver necessidade comprovada de mais de 2 níveis;
- a associação produto-categoria evoluir para muitos-para-muitos;
- categorias passarem a controlar preço, disponibilidade ou regras financeiras;
- o catálogo for separado por canais/unidades de forma incompatível com este modelo.

## 11. Relação com o Documento Mestre

**Esta decisão deve atualizar o Documento Mestre.**

O Documento Mestre deverá registrar:
- suporte a categoria principal + subcategoria;
- imagem e descrição breve em categoria principal;
- hierarquia limitada a 2 níveis;
- compatibilidade com categorias atuais;
- ausência de impacto financeiro direto.


## 12. Encerramento técnico — CAT-4

**Data:** 2026-10-13  
**Status do gate:** PASS E2E

Evidências consolidadas:

- CAT-1 aplicado em produção com migration aditiva;
- 16 categorias e 32 produtos preservados após a migration;
- 0 produtos órfãos;
- constraints de auto-parent, profundidade máxima e isolamento por restaurante validadas;
- policy pública revisada para considerar itens ativos nas subcategorias;
- CAT-2 publicado em produção e staging;
- CAT-3 publicado em produção e staging;
- fluxo sintético controlado validado com `ROLLBACK`:
  - categoria principal;
  - subcategoria;
  - produto vinculado à subcategoria;
  - visibilidade da categoria principal e da subcategoria;
  - rejeição de alteração cross-tenant;
  - bloqueio de exclusão da categoria principal com filho;
- resultado do teste: `CAT4_DB_FLOW_PASS`;
- resíduos após rollback: 0 categorias / 0 produtos;
- builds e deployments pós-merge em produção e staging: READY / SUCCESS.

Validação operacional complementar:

Em 2026-10-13, foi confirmada a execução de um pedido E2E pela interface utilizando produto vinculado a subcategoria, com fluxo de checkout concluído sem divergência reportada de valor.

Com essa validação, a pendência operacional do CAT-4 foi encerrada.

Observação de evidência:
- a confirmação operacional foi fornecida pelo responsável pelo teste;
- não foi realizada, nesta atualização documental, uma auditoria independente dos logs financeiros do pedido.
