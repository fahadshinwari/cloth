import "server-only";

/**
 * Tenant-aware query helpers.
 *
 * Every function here REQUIRES an explicit tenantId that comes from the
 * authenticated session (see requireMerchantAdmin in lib/auth.ts).
 * There is deliberately no way to query merchant data without a tenant scope.
 */

export interface TenantScope {
  tenantId: string;
}

/**
 * Example of the pattern all future business modules must follow:
 *
 *   export async function listInvoices({ tenantId }: TenantScope) {
 *     await connectToDatabase();
 *     return InvoiceModel.find({ tenantId }).sort({ createdAt: -1 });
 *   }
 *
 * The `tenantId` ALWAYS originates from the session token (lib/session.ts),
 * which is signed server-side and cannot be tampered with from the client.
 */
export function assertTenantScope(scope: TenantScope): string {
  if (!scope.tenantId) {
    throw new Error("tenantId is required for tenant-scoped queries");
  }
  return scope.tenantId;
}
