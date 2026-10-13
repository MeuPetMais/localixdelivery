# Especificação funcional — Categorias e Subcategorias

## Objetivo

Melhorar a organização visual e operacional do cardápio sem alterar o modelo financeiro ou o fluxo de pedidos.

## Experiência do parceiro

### Categoria principal
Campos:
- Nome — obrigatório;
- Descrição breve — opcional, recomendação de até 160 caracteres;
- Foto — opcional;
- Ordem — existente;
- Subcategorias — opcionais.

Ações:
- criar;
- editar;
- excluir somente quando regra de filhos/produtos permitir;
- gerenciar subcategorias.

### Subcategoria
Campos:
- Nome — obrigatório;
- Categoria principal — obrigatório;
- Ordem.

Ações:
- criar;
- editar;
- excluir mediante tratamento explícito dos produtos vinculados.

### Produto
O seletor de categoria deve apresentar:

```text
Pizzas
  ├─ Tradicionais
  ├─ Especiais
  └─ Doces
Hambúrgueres
  ├─ Bovinos
  └─ Frango
Bebidas
```

Categorias sem subcategoria continuam selecionáveis diretamente.

## Experiência do consumidor

Categoria principal:
- imagem de capa;
- nome;
- descrição breve.

Se houver subcategorias:
- exibir os nomes das subcategorias;
- agrupar produtos sob cada subcategoria.

Se não houver:
- exibir produtos diretamente como hoje.

## Regras de exclusão recomendadas

1. Categoria principal com subcategorias não deve ser excluída silenciosamente.
2. Subcategoria com produtos não deve ser excluída silenciosamente.
3. A UI deve exigir:
   - mover os produtos; ou
   - confirmar uma estratégia definida de reassociação.
4. Não usar cascade que apague produtos.

## Critérios de aceite

- cardápios existentes continuam funcionais sem edição;
- nova categoria pode receber foto e descrição;
- é possível criar uma subcategoria;
- terceiro nível é rejeitado no banco;
- subcategoria de outro restaurante é rejeitada;
- produto pode ser vinculado à subcategoria;
- categoria-mãe aparece publicamente mesmo quando só filhos contêm produtos ativos;
- checkout do produto funciona sem mudança no preço;
- RLS impede alteração cross-tenant.
