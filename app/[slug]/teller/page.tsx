import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getTellerLedgerView } from "@/lib/services/teller.service";
import { formatMinorAmount } from "@/lib/i18n/format";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { ledgerFiltersFromSearchParams } from "@/lib/ledger-params";
import { createTellerTransactionAction } from "@/app/actions/teller.actions";
import { Card } from "../../_components/ui";
import { LedgerTable } from "../_components/ledger-table";
import { LedgerFilters } from "../_components/ledger-filters";
import { TellerForm } from "../_components/teller-form";

export default async function TellerPage({
  params,
  searchParams,
}: PageProps<"/[slug]/teller">) {
  const { slug } = await params;
  const filters = ledgerFiltersFromSearchParams(await searchParams);

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
  const ledgerView = await getTellerLedgerView(tenantId, filters);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("teller.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("teller.subtitle")}</p>
      </div>

      {/* Current cash on hand — per currency, derived from manual transactions. */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("teller.balanceTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("teller.cashAFN")}
            </div>
            <div className="mt-1 text-2xl font-semibold" dir="ltr">
              {formatMinorAmount(ledgerView.closing.AFN, "AFN")}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("teller.cashUSD")}
            </div>
            <div className="mt-1 text-2xl font-semibold" dir="ltr">
              {formatMinorAmount(ledgerView.closing.USD, "USD")}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("teller.manualHint")}</p>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("teller.addTransaction")}
        </h2>
        <TellerForm action={createTellerTransactionAction} />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("teller.history")}
        </h2>
        <div className="mb-4">
          <LedgerFilters
            typeOptions={[
              { value: "add", label: t("teller.typeAdd") },
              { value: "remove", label: t("teller.typeRemove") },
            ]}
          />
        </div>
        <LedgerTable
          view={ledgerView}
          kind="teller"
          locale={locale}
          emptyMessage={t("teller.empty")}
        />
      </Card>
    </div>
  );
}
