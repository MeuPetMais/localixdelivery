# Documento Mestre — Atualização DEC-015

## Hierarquia de categorias no cardápio

**Data:** 2026-10-13  
**Origem:** DEC-015  
**Status:** Implementada — VALIDADA E2E

O Localix Delivery passa a suportar uma hierarquia de cardápio limitada a dois níveis:

```text
Categoria principal
└── Subcategoria
    └── Produtos
```

Regras oficiais:

- categoria principal pode possuir nome, foto e descrição breve;
- subcategoria pertence obrigatoriamente a uma categoria principal do mesmo restaurante;
- não é permitido terceiro nível;
- categorias existentes permanecem categorias principais;
- produtos existentes não são migrados automaticamente;
- `menu_items.category_id` permanece como vínculo canônico do produto;
- produtos podem permanecer diretamente na categoria principal quando não houver necessidade de subcategoria;
- a vitrine pública exibe categoria principal com foto, nome e descrição e agrupa produtos por subcategoria quando houver;
- a categoria principal continua pública quando houver item ativo apenas em uma subcategoria;
- exclusão não deve apagar produtos em cascata;
- a hierarquia é metadado de catálogo e não altera preço, checkout, pagamento, split ou benefícios.

Componentes financeiros e de pedido permanecem autoritativos e independentes da hierarquia:
- Checkout;
- OrderService;
- PricingEngine;
- PaymentService;
- Mercado Pago;
- taxa de serviço;
- Localix Benefits.

Validação operacional:

Em 2026-10-13, foi confirmada a execução de pedido E2E pela interface com produto vinculado a subcategoria, sem divergência de valor reportada e sem interferência observada da hierarquia de categoria no checkout.

A DEC-015 fica encerrada como **Implementada — VALIDADA E2E**.

Esta atualização deve ser incorporada ao Documento Mestre consolidado na próxima revisão documental.
