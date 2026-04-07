# Facturació Automàtica TuSecre → Odoo

## Objectiu

Quan Stripe confirma el pagament mensual d'un client de TuSecre, el bot genera
automàticament una factura a Odoo (Effiguard) amb la sèrie `TS` i l'envia per
email al client.

## Flux complet

```
Stripe cobra 5€ al client
  → Stripe llança un Webhook (event: invoice.payment_succeeded)
    → Bot TuSecre (src/routes/stripe.ts) rep l'event
      → Busca les dades fiscals del client a la BD (fiscalName, nif, adreça...)
        → Crida l'API d'Odoo per crear la factura
          → Odoo genera el PDF i l'envia per email al client
```

---

## Prerequisits

### 1. A Odoo (Effiguard)
- Crear una **Sèrie de facturació** específica per a TuSecre: `TS/YYYY/XXXXX`
  - Comptabilitat → Configuració → Seqüències → Nova seqüència
  - Prefix: `TS/%(year)s/`
- Crear un **Producte** a Odoo: "Subscripció TuSecre" — 5€/mes + IVA (21%)
  - Obtenir l'ID del producte (`product_id`) per usar-lo a l'API
- Activar l'accés a l'**API JSON-RPC** d'Odoo
  - Configuració → Tècnic → Usuaris → Crear usuari API
  - Obtenir: `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD`

### 2. Al bot TuSecre
- La BD ha de tenir les dades fiscals del client guardades:
  - `fiscalName` (Nom Fiscal)
  - `nif` (NIF/CIF)
  - `address` (Adreça)
  - `postalCode` (Codi Postal)
  - `city` (Població)
- Afegir aquests camps al model `User` de Prisma si no existeixen

---

## Variables d'entorn noves (`.env`)

```env
ODOO_URL="https://effiguard.odoo.com"
ODOO_DB="effiguard"
ODOO_USER="api@effiguard.com"
ODOO_PASSWORD="la_teva_api_key"
ODOO_TUSECRE_PRODUCT_ID=123        # ID del producte "Subscripció TuSecre" a Odoo
ODOO_TUSECRE_JOURNAL_ID=456        # ID del diari comptable amb sèrie TS/
```

---

## Fitxers a crear/modificar

### [NOU] `src/services/odoo.ts`

Servei per comunicar-se amb l'API JSON-RPC d'Odoo:

```typescript
// Autenticació
async function authenticate(): Promise<number>

// Crear client a Odoo (res.partner)
async function createOrGetPartner(fiscalData: FiscalData): Promise<number>

// Crear factura (account.move)
async function createInvoice(partnerId: number, amount: number): Promise<number>

// Confirmar i enviar la factura per email
async function confirmAndSendInvoice(invoiceId: number): Promise<void>
```

**Exemple de crida JSON-RPC:**
```typescript
const response = await fetch(`${ODOO_URL}/jsonrpc`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service: 'object',
      method: 'execute_kw',
      args: [ODOO_DB, uid, ODOO_PASSWORD,
        'account.move', 'create', [{
          move_type: 'out_invoice',
          journal_id: ODOO_TUSECRE_JOURNAL_ID,
          partner_id: partnerId,
          invoice_line_ids: [[0, 0, {
            product_id: ODOO_TUSECRE_PRODUCT_ID,
            quantity: 1,
            price_unit: 5.0,
          }]]
        }]
      ]
    }
  })
});
```

### [MODIFICAR] `src/routes/stripe.ts`

Afegir handler per a l'event `invoice.payment_succeeded`:

```typescript
case 'invoice.payment_succeeded': {
  const invoice = event.data.object as Stripe.Invoice;
  const customerEmail = invoice.customer_email;

  // 1. Buscar usuari per email
  const user = await prisma.user.findFirst({ where: { email: customerEmail } });
  if (!user?.fiscalName || !user?.nif) break; // Si no ha demanat factura, skip

  // 2. Crear/obtenir partner a Odoo
  const partnerId = await odooService.createOrGetPartner({
    name: user.fiscalName,
    nif: user.nif,
    address: user.address,
    postalCode: user.postalCode,
    city: user.city,
    email: customerEmail
  });

  // 3. Crear factura a Odoo i enviar-la
  const invoiceId = await odooService.createInvoice(partnerId, 5.0);
  await odooService.confirmAndSendInvoice(invoiceId);

  console.log(`[Odoo] Factura creada per ${user.fiscalName} (${user.nif})`);
  break;
}
```

### [MODIFICAR] `prisma/schema.prisma`

Afegir camps fiscals al model `User`:

```prisma
model User {
  // ... camps existents ...
  fiscalName    String?
  nif           String?
  address       String?
  postalCode    String?
  city          String?
  wantsInvoice  Boolean @default(false)
}
```

### [MODIFICAR] `src/routes/whatsapp.ts`

Afegir intent `WANTS_INVOICE` al flux de pagament:

Quan l'usuari accepta pagar → el bot pregunta:
> "Vols rebre factura? Respon 'sí' o 'no'."

Si `sí` → bot demana dades fiscals una per una i les guarda.

---

## Ordre d'implementació

1. `[ ]` Afegir camps al model Prisma i fer migració
2. `[ ]` Configurar Odoo: sèrie TS/, producte, usuari API
3. `[ ]` Crear `src/services/odoo.ts`
4. `[ ]` Afegir lògica "vols factura?" al flux de pagament del bot (`whatsapp.ts`)
5. `[ ]` Modificar `src/routes/stripe.ts` per escoltar `invoice.payment_succeeded`
6. `[ ]` Proves end-to-end en mode Stripe test
7. `[ ]` Deploy al VPS

---

## Notes

- Odoo Online (SaaS) limita l'accés API per pla. Verificar que el pla d'Effiguard ho permet.
- Si Odoo no és accessible via API, alternativa: generar el PDF al bot amb `pdfkit` i enviar-lo per email directament sense Odoo.
- Per a escala molt petita (<20 clients), la facturació manual a Odoo és suficient fins que calgui automatitzar.
