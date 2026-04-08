# Pla d'Implementació: Emissió de Factures (Veri*Factu & FacturaE)

Aquest document detalla el camí per transformar TuSecre d'un gestor de despeses a un sistema d'emissió de factures completament homologat amb la nova normativa **Veri*Factu**.

## 1. Casuístiques de l'Autònom (Dubtes a resoldre)

Perquè el sistema sigui útil per a qualsevol autònom, hem de preveure diversos escenaris complexos:

### Tipus d'IVA i Impostos
- **IVA Multi-línia:** Una sola factura pot tenir línies al 21% (manteniment) i línies al 10% (materials específics).
- **Retenció IRPF (-15% o -7%):** Els professionals autònoms que facturen a empreses han d'aplicar retenció al peu de la factura.
- **Recàrrec d'Equivalència (RE):** Per a autònoms en comerç detallista (un plus d'IVA que no es dedueixen).
- **Factures Exemptes:** Serveis de formació, metges, etc., que no porten IVA.

### Tipus de Clients
- **Nacionals:** Amb NIF/CIF estàndard.
- **Intracomunitaris (VIES):** Factures sense IVA per a empreses de la UE.
- **Internacionals:** Exportacions de serveis fora de la UE.

### Tipus de Factures
- **Factura Ordinària:** La normal.
- **Factura Simplificada (Tiquet):** Per a vendes ràpides sense dades del client (fins a cert import).
- **Factura Rectificativa:** Per anul·lar o corregir una factura anterior (obligatori per Veri*Factu).

---

## 2. Passos Tècnics per a la Implementació

### Fase A: Base de Dades i Models
1.  **Taules de Clients:** Guardar nom, NIF i adreça dels clients habituals de l'usuari per no haver-los de demanar cada vegada.
2.  **Taula `IssuedInvoice`:** Amb camps per a la sèrie, número i el **Hash Veri*Factu**.
3.  **Taula `InvoiceLine`:** Per permetre múltiples conceptes amb IVAs diferents.

### Fase B: Lògica de Signatura i Hash
1.  **Custòdia del Certificat:** Sistema segur per guardar el certificat digital de l'autònom (xifrat a la BD).
2.  **Motor de Signatura XAdES:** Implementació de la signatura criptogràfica de l'XML.
3.  **Algoritme d'Encadenament:** Funció que llegeix el hash de l'última factura i el clava a la següent.

### Fase C: Interfície WhatsApp (UX)
1.  **Flux d'emissió:** Com demanar les dades sense que sigui pesat?
    - *Usuari:* "Crea factura per a Gestoria ABC"
    - *Bot:* "Entès. Quin és el concepte?"
    - *Usuari:* "Assessoria març, 200€"
    - *Bot:* "Vols afegir una altra línia o aplico l'IVA del 21%?"
2.  **Generació de PDF i QR:** Creació del PDF visual amb el codi QR de l'AEAT.

---

## 3. Preguntes Obertes (Dubtes Tècnics)

> [!IMPORTANT]
> **Seguretat dels Certificats:** Com vols que l'usuari ens doni el seu certificat FNMT? Pujant un fitxer .p12 per WhatsApp (arriscat) o mitjançant un enllaç segur temporal d'un sol ús?

> [!WARNING]
> **Homologació:** Per ser Veri*Factu oficial, TuSecre ha de figurar en un llistat de l'AEAT. Estàs disposat a fer el tràmit administratiu necessari una vegada tinguem el codi llest?

---

## 4. Auditoria de Veri*Factu
El programari haurà d'incloure un **"Registre d'Esdeveniments"** que guardi qui ha accedit al sistema i quan, per evitar manipulacions de dades a posteriori.
