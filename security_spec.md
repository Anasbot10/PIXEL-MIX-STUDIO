# Security Specification — AM PIXEL STUDIO Business Manager

## 1. Data Invariants

1. **Strict Ownership Isolation (PII & Financial Ledger)**: Every document across `settings`, `customers`, `services`, `projects`, `quotations`, `invoices`, `payments`, and `expenses` MUST belong to a single verified `ownerId == request.auth.uid`. No user may read, list, create, update, or delete another user's data (except the verified bootstrapped admin `mudakaparaban@gmail.com`).
2. **Email Verification Enforcement**: Every write and admin privilege check requires `request.auth.token.email_verified == true`.
3. **Referential Integrity**:
   - Creating a `project`, `quotation`, or `invoice` requires that `customerId` exists in `/customers/{customerId}` and belongs to `request.auth.uid`.
   - Creating a `payment` requires that `invoiceId` exists in `/invoices/{invoiceId}` and belongs to `request.auth.uid`, and `customerId` exists in `/customers/{customerId}` and belongs to `request.auth.uid`.
4. **Accounting Integrity**:
   - An invoice CANNOT be created directly in `Paid` status with `amountPaid == 0`; newly created invoices must start with `amountPaid == 0` and status in `['Draft', 'Unpaid']`.
   - Payment `originalAmount > 0` and `exchangeRate > 0`.
   - Expense `originalAmount > 0` and `exchangeRate > 0`.
5. **Immutable Audit Fields & Server Timestamps**:
   - `ownerId` and `createdAt` are immutable after creation.
   - `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
6. **Bounded Payloads & Path Hardening**:
   - All document IDs match `^[a-zA-Z0-9_\-]+$` and `<= 128` chars.
   - All strings have explicit `.size()` caps synchronized with `firebase-blueprint.json`.
   - Line-item arrays (`items`) on quotations and invoices are bounded (`size >= 1 && size <= 50`) and the first element is type-checked as a map.
7. **Terminal State Locking**:
   - Cancelled invoices and Cancelled/Completed projects cannot be modified by non-admin accounts once in terminal state (with `isAdmin()` override for corrections).
8. **Secure List Queries**:
   - Every `allow list` explicitly checks `resource.data.ownerId == request.auth.uid` (no blanket `isSignedIn()` reads, no `get()` calls inside `allow list`).

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)

1. **Identity Spoofing**: Creating a customer with `ownerId: "victim-uid"` while signed in as `attacker-uid`.
2. **Shadow Field Injection**: Creating an invoice with an extra undeclared ghost key `isAdminApproved: true`.
3. **Email Spoofing (Unverified Admin)**: Attempting to read another user's customer record with `email: "mudakaparaban@gmail.com"` and `email_verified: false`.
4. **PII Blanket Read**: Attempting `get` on `/customers/{victimCustomerId}` as an authenticated non-owner user.
5. **Unscoped List Query Scraping**: Running `getDocs(collection(db, 'invoices'))` without `where('ownerId', '==', auth.uid)`.
6. **Document ID Poisoning**: Creating `/customers/` with a 200-char ID or special characters `../admin`.
7. **Timestamp Forgery**: Creating an expense with a backdated client timestamp `createdAt: Timestamp(2020-01-01)`.
8. **Owner Reassignment on Update**: Updating a project to change `ownerId` to another UID.
9. **Orphaned Payment Creation**: Creating a payment referencing a non-existent `invoiceId: "fake-inv-999"`.
10. **Invoice Direct-to-Paid Bypass**: Creating an invoice with `status: "Paid"` and `amountPaid: 0`.
11. **Value Poisoning on Update**: Updating a customer's `fullName` to a boolean `true` or a 500-char string exceeding `maxLength: 120`.
12. **Array Exhaustion**: Creating a quotation with 51 line items (`items.size() > 50`) or empty `items: []`.
