import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getPartnerById, listInvestments } from "@/lib/services/partner.service";
import { formatDate, formatMinorAmount } from "@/lib/i18n/format";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { createInvestmentAction, updatePartnerAction } from "@/app/actions/partner.actions";
import { Card } from "../../../_components/ui";
import { EntityForm } from "../../_components/entity-form";
import { TransactionForm } from "../../_components/transaction-form";
import { EntryRowActions } from "../../_components/entry-row-actions";

export default async function PartnerDetailPage({
  params,
}: PageProps<"/[slug]/partners/[id]">) {
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

  const partner = await getPartnerById(String(shop._id), id);
  if (!partner) notFound();

  const investments = await listInvestments(String(shop._id), id);

  // Per-currency totals for this partner — derived from history, never stored.
  const totalsAFN = investments
    .filter((inv) => inv.currency === "AFN")
    .reduce((sum, inv) => sum + inv.amountMinor, 0);
  const totalsUSD = investments
    .filter((inv) => inv.currency === "USD")
    .reduce((sum, inv) => sum + inv.amountMinor, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/partners`} className="text-sm text-zinc-500 hover:underline">
          ← {t("partners.title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{partner.name}</h1>
        {partner.notes ? <p className="mt-1 text-sm text-zinc-500">{partner.notes}</p> : null}
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("partners.details")}
        </h2>
        <EntityForm
          action={updatePartnerAction.bind(null, String(partner._id))}
          values={{
            name: partner.name,
            phone: partner.phone,
            notes: partner.notes,
            status: partner.status,
          }}
          submitLabel={t("common.save")}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("partners.addInvestment")}
        </h2>
        <TransactionForm
          action={createInvestmentAction}
          hiddenIdField="partnerId"
          hiddenIdValue={String(partner._id)}
          amountLabel={t("partners.fields.amount")}
          submitLabel={t("partners.record")}
        />
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("partners.history")}
          </h2>
          <div className="flex gap-4 text-sm" dir="ltr">
            <span className="font-medium">{formatMinorAmount(totalsAFN, "AFN")}</span>
            <span className="font-medium">{formatMinorAmount(totalsUSD, "USD")}</span>
          </div>
        </div>

        {investments.length === 0 ? (
          <p className="text-center text-zinc-500">{t("partners.noInvestments")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-start text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="px-4 py-3 text-start font-medium">{t("partners.fields.date")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("partners.fields.amount")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("partners.fields.note")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("partners.recordedBy")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((investment) => (
                  <tr
                    key={String(investment._id)}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-4 py-3">{formatDate(investment.investedAt, locale)}</td>
                    <td className="px-4 py-3 font-medium" dir="ltr">
                      {formatMinorAmount(investment.amountMinor, investment.currency)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{investment.note || "—"}</td>
                    {/* "Created by / created date" — recording audit info. */}
                    <td className="px-4 py-3 text-zinc-500">
                      {formatDate(investment.createdAt ?? investment.investedAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <EntryRowActions kind="investment" entryId={String(investment._id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
