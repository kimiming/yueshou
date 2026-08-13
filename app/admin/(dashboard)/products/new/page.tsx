import { AdminPageTitle } from "@/components/admin/antd-server-bridge";
import { ProductForm } from "@/components/admin/domain-forms";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { saveProductAction } from "../actions";

export default async function NewProductPage() { await requireUser(); const categories = await prisma.productCategory.findMany({ where: { deletedAt: null, status: "PUBLISHED" }, include: { translations: { where: { locale: "en" }, take: 1 } } }); return <main><AdminPageTitle level={1}>新建产品</AdminPageTitle><ProductForm categories={categories.map((item) => ({ id: item.id, label: item.translations[0]?.title ?? item.slug }))} save={saveProductAction} /></main>; }
