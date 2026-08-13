import { AdminPageTitle, Card } from "@/components/admin/antd-server-bridge";
import { MediaUploadPage } from "@/components/admin/media-upload-page";
import { requireUser } from "@/lib/auth/permissions";

export default async function NewMediaPage() { await requireUser(); return <main><AdminPageTitle level={1}>上传图片</AdminPageTitle><Card><MediaUploadPage /></Card></main>; }
