export const publicationStatusOptions = [
  { value: "DRAFT", label: "草稿" },
  { value: "PUBLISHED", label: "已发布" },
  { value: "ARCHIVED", label: "已归档" },
];

export const inquiryStatusOptions = [
  { value: "NEW", label: "新建" },
  { value: "IN_PROGRESS", label: "处理中" },
  { value: "RESOLVED", label: "已解决" },
  { value: "ARCHIVED", label: "已归档" },
];

export const roleOptions = [
  { value: "EDITOR", label: "编辑员" },
  { value: "ADMIN", label: "管理员" },
];

const labels: Record<string, string> = Object.fromEntries([
  ...publicationStatusOptions,
  ...inquiryStatusOptions,
  ...roleOptions,
].map(({ value, label }) => [value, label]));

export function adminValueLabel(value: string) {
  return labels[value] ?? value;
}

export const localeLabels: Record<string, string> = {
  en: "英语（必填）",
  "zh-CN": "简体中文",
  de: "德语",
  fr: "法语",
  es: "西班牙语",
};

export const sectionTypeLabels: Record<string, string> = {
  hero: "首屏横幅",
  services: "服务",
  about: "关于我们",
  capabilities: "能力",
  quality: "质量保障",
  "product-categories": "产品分类",
  "global-reach": "全球业务",
  factory: "我们的工厂",
  stats: "数据统计",
  news: "新闻",
  cta: "行动按钮",
};
