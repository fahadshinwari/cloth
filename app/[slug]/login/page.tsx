import { getShopBySlug } from "@/lib/services/tenant.service";
import { notFound } from "next/navigation";
import { ShopLoginForm } from "./shop-login-form";

export default async function ShopLoginPage({ params }: PageProps<"/[slug]/login">) {
  const { slug } = await params;

  // Show a clean 404 for unknown shops.
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  return <ShopLoginForm slug={shop.slug} shopName={shop.name} />;
}
