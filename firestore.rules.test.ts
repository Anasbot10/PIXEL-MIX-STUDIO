/**
 * Security Rules Test Specification for AM PIXEL STUDIO – Business Manager
 * Verifies all 12 "Dirty Dozen" payloads return PERMISSION_DENIED against firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Customer Create',
    collectionPath: '/customers/cust_spoof_1',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: { ownerId: 'victim_uid', customerCode: 'CUST-001', fullName: 'Victim Client' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Ghost Field Injection on Invoice',
    collectionPath: '/invoices/inv_ghost_1',
    operation: 'create',
    auth: { uid: 'owner_1', email: 'owner@example.com', email_verified: true },
    payload: { ownerId: 'owner_1', invoiceNumber: 'INV-2026-001', ghostAdminFlag: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Admin Spoofing',
    collectionPath: '/customers/victim_cust_1',
    operation: 'get',
    auth: { uid: 'spoof_uid', email: 'mudakaparaban@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-Tenant PII Blanket Get',
    collectionPath: '/customers/victim_cust_1',
    operation: 'get',
    auth: { uid: 'other_user', email: 'other@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unscoped Collection List Scraping',
    collectionPath: '/invoices',
    operation: 'list',
    auth: { uid: 'other_user', email: 'other@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Document ID Poisoning (>128 chars)',
    collectionPath: `/customers/${'a'.repeat(150)}`,
    operation: 'create',
    auth: { uid: 'owner_1', email: 'owner@example.com', email_verified: true },
    payload: { ownerId: 'owner_1', fullName: 'Long ID Attack' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Client Timestamp Forgery on Expense',
    collectionPath: '/expenses/exp_time_1',
    operation: 'create',
    auth: { uid: 'owner_1', email: 'owner@example.com', email_verified: true },
    payload: { ownerId: 'owner_1', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immutable OwnerId Reassignment on Project Update',
    collectionPath: '/projects/prj_1',
    operation: 'update',
    auth: { uid: 'owner_1', email: 'owner@example.com', email_verified: true },
    payload: { ownerId: 'attacker_uid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned Payment Referencing Non-Existent Invoice',
    collectionPath: '/payments/pay_orphan_1',
    operation: 'create',
    auth: { uid: 'owner_1', email: 'owner@example.com', email_verified: true },
    payload: { ownerId: 'owner_1', invoiceId: 'does_not_exist_999', originalAmount: 5000 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invoice Direct-to-Paid Without Payment Record',
    collectionPath: '/invoices/inv_paid_bypass',
    operation: 'create',
    auth: { uid: 'owner_1', email: 'owner@example.com', email_verified: true },
    payload: { ownerId: 'owner_1', status: 'Paid', amountPaid: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Poisoning (Invalid Type / Oversized Name) on Customer Update',
    collectionPath: '/customers/cust_1',
    operation: 'update',
    auth: { uid: 'owner_1', email: 'owner@example.com', email_verified: true },
    payload: { fullName: 'X'.repeat(250) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unbounded Line-Items Array Exhaustion on Quotation',
    collectionPath: '/quotations/qt_array_overflow',
    operation: 'create',
    auth: { uid: 'owner_1', email: 'owner@example.com', email_verified: true },
    payload: { ownerId: 'owner_1', items: Array.from({ length: 55 }, () => ({ name: 'Item' })) },
    expected: 'PERMISSION_DENIED',
  },
];
