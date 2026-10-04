import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import {
  getClothById,
  getStockByCloth,
  listMovements,
} from "@/lib/services/inventory.service";
import { getSupplierById, listSuppliers } from "@/lib/services/supplier.service";
import { listBuyers } from "@/lib/services/buyer.service";
import { formatDate, formatMinorAmount } from "@/lib/i18n/format";
import { formatMeters } from "@/lib/measure";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { updateClothAction } from "@/app/actions/inventory.actions";
import { Card } from "../../../_components/ui";
import { ClothForm } from "../../_components/cloth-form";
import { InventoryTransactionForm } from "../../_components/inventory-transaction-form";

export default async function ClothDetailPage({
  params,
}: PageProps<"/[slug]/inventory/[id]">) {
  const { slug, id } = await params;

  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const ctx = await getAuthContext();
  if (!ctx) redirect(`/${slug}/login`);

  if (ctx.session.role === USER_ROLE.MERCHANT_ADMIN) {
    if (ctx.session.tenantSlug !== slug || ctx.session.tenantId !== String(shop._id)) {
      redirect(`/${ctx.session.tenantSlug}/dashboard`);
    }
  }

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  const tenantId = String(shop._id);
  const cloth = await getClothById(tenantId, id);
  if (!cloth) notFound();

  const [movements, suppliers, buyers] = await Promise.all([
    listMovements(tenantId, { clothId: id, limit: 200 }),
    listSuppliers(tenantId),
    listBuyers(tenantId),
  ]);

  const stock = await getStockByCloth(tenantId);
  const stockMm = stock.get(id) ?? 0;
  const valueMinor = Math.round((stockMm / 1000) * cloth.pricePerMeterMinor);

  // Resolve the optional preferred supplier for display.
  const preferredSupplier = cloth.supplierId
    ? await getSupplierById(tenantId, String(cloth.supplierId))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/inventory`} className="text-sm text-zinc-500 hover:underline">
          ← {t("inventory.title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{cloth.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {cloth.category || "—"}
          {preferredSupplier ? ` · ${preferredSupplier.name}` : ""}
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("inventory.stockCard")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("inventory.currentStock")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMeters(stockMm)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("inventory.fields.pricePerMeter")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(cloth.pricePerMeterMinor, cloth.currency)} / m
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("inventory.fields.value")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(valueMinor, cloth.currency)}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("inventory.derivedHint")}</p>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("inventory.newTransaction")}
        </h2>
        <InventoryTransactionForm
          clothId={String(cloth._id)}
          cloths={[
            {
              id: String(cloth._id),
              name: cloth.name,
              currency: cloth.currency,
              pricePerMeter: String(cloth.pricePerMeterMinor / 100),
            },
          ]}
          suppliers={suppliers.map((supplier) => ({
            id: String(supplier._id),
            name: supplier.name,
            companyName: supplier.companyName,
          }))}
          buyers={buyers.map((buyer) => ({
            id: String(buyer._id),
            name: buyer.name,
            shopName: buyer.shopName,
          }))}
          submitLabel={t("buyers.record")}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("inventory.history")}
        </h2>
        {movements.length === 0 ? (
          <p className="text-center text-zinc-500">{t("inventory.noMovements")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-start text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="px-4 py-3 text-start font-medium">{t("buyers.fields.date")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.direction")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.quantity")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.pricePerMeter")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.value")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.source")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("partners.fields.note")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr
                    key={String(movement._id)}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-4 py-3">{formatDate(movement.occurredAt, locale)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          movement.direction === "in"
                            ? "font-medium text-emerald-600 dark:text-emerald-400"
                            : "font-medium text-amber-600 dark:text-amber-400"
                        }
                      >
                        {movement.direction === "in" ? "IN" : "OUT"}
                      </span>
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {formatMeters(movement.quantityMm)}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {formatMinorAmount(movement.pricePerMeterMinor, movement.currency)}
                    </td>
                    <td className="px-4 py-3 font-medium" dir="ltr">
                      {formatMinorAmount(movement.totalValueMinor, movement.currency)}
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-500">{movement.sourceType}</td>
                    <td className="px-4 py-3 text-zinc-500">{movement.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("inventory.details")}
        </h2>
        <ClothForm
          action={updateClothAction.bind(null, String(cloth._id))}
          values={{
            name: cloth.name,
            category: cloth.category,
            description: cloth.description,
            pricePerMeter: String(cloth.pricePerMeterMinor / 100),
            currency: cloth.currency,
            supplierId: cloth.supplierId ? String(cloth.supplierId) : "",
            lowStockThresholdMeters:
              cloth.lowStockThresholdMm != null ? String(cloth.lowStockThresholdMm / 1000) : "",
            notes: cloth.notes,
          }}
          suppliers={suppliers.map((supplier) => ({
            id: String(supplier._id),
            name: supplier.name,
            companyName: supplier.companyName,
          }))}
          submitLabel={t("common.save")}
        />
      </Card>
    </div>
  );
}
