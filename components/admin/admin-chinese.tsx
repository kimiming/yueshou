"use client";

import { useEffect } from "react";

const exact: Record<string, string> = {
  Dashboard: "仪表盘", Content: "内容管理", Services: "服务管理", Products: "产品管理", News: "新闻管理",
  Navigation: "导航管理", Media: "媒体库", Inquiries: "询盘管理", Settings: "网站设置", Users: "用户管理", Audit: "审计日志",
  "Audit log": "审计日志", "Media library": "媒体库", "Site settings": "网站设置", "Menu structure": "菜单结构",
  "Top-level navigation": "顶级导航", "Add menu item": "添加菜单项", "Page editor": "页面编辑器", Translations: "翻译",
  Sections: "页面区块", "Add section": "添加区块", "Section type": "区块类型", Enabled: "已启用", Visible: "显示",
  Pages: "页面列表", Articles: "文章列表", "Product catalogue": "产品目录", "Service catalogue": "服务目录",
  "Article categories": "文章分类", "Product categories": "产品分类", Tags: "标签", Category: "分类",
  Title: "标题", Body: "正文", Excerpt: "摘要", "Alternative text": "替代文本", Label: "显示名称",
  Slug: "路径标识（Slug）", Link: "链接", Position: "排序位置", "Parent menu ID": "父菜单 ID",
  Status: "状态", "Current status": "当前状态", "Publication status": "发布状态", "Account state": "账号状态",
  DRAFT: "草稿", PUBLISHED: "已发布", ARCHIVED: "已归档", NEW: "新建", IN_PROGRESS: "处理中", RESOLVED: "已解决",
  ADMIN: "管理员", EDITOR: "编辑员", Active: "启用", Disabled: "停用", active: "已启用", disabled: "已停用",
  Filter: "筛选", Previous: "上一页", Next: "下一页", Save: "保存", New: "新建", Edit: "编辑", Archive: "归档", Publish: "发布",
  "Save draft": "保存草稿", "Save changes": "保存更改", "Save settings": "保存设置", "Save metadata": "保存媒体信息",
  "Save menu item": "保存菜单项", "Save section": "保存区块", "Save product": "保存产品", "Save article": "保存文章",
  "Create page": "创建页面", "Create service": "创建服务", "Edit service": "编辑服务", "Create user": "创建用户",
  "Product editor": "产品编辑器", "News editor": "新闻编辑器", "Published media": "已发布媒体",
  "Upload image": "上传图片", "Clear selection": "清除选择", "No media selected": "尚未选择媒体",
  "No sections yet.": "暂无区块。", "No inquiries yet.": "暂无询盘。", "No media assets yet.": "暂无媒体资源。",
  "All statuses": "全部状态", "Export CSV": "导出 CSV", "Private attachments": "私密附件",
  "Internal notes": "内部备注", "Update status": "更新状态", "Save notes": "保存备注",
  "Temporary password": "临时密码", Role: "角色", "Reset password": "重置密码", "Save account": "保存账号",
  "Leave blank to keep": "留空则保持不变", "Company name": "公司名称", Slogan: "宣传语", Email: "邮箱", Phone: "电话",
  "Company address": "公司地址", Remove: "删除", "Add address line": "添加地址行", "Logo media": "Logo 媒体",
  "Favicon media": "网站图标媒体", "Social links": "社交链接", "Add social link": "添加社交链接",
  "Default SEO": "默认 SEO", "Footer columns": "页脚栏目", Heading: "栏目标题", "Add footer column": "添加页脚栏目",
  "SEO title": "SEO 标题", "SEO description": "SEO 描述", "SEO keywords": "SEO 关键词",
  "Schedule publication": "定时发布", "Article count": "文章数量", "CTA label": "行动按钮文字", "CTA link": "行动按钮链接",
  "Publish media": "发布媒体", "Archive safely": "安全归档", "English (required)": "英语（必填）",
};

const phrases: Array<[RegExp, string]> = [
  [/^Search pages$/, "搜索页面"], [/^Search services$/, "搜索服务"], [/^Search products$/, "搜索产品"],
  [/^Search articles$/, "搜索文章"], [/^Search media$/, "搜索媒体"], [/^Search company, contact or email$/, "搜索公司、联系人或邮箱"],
  [/^Page (\d+) of (\d+)$/, "第 $1 页，共 $2 页"], [/^Page (\d+)$/, "第 $1 页"],
  [/^Selected assets: (\d+)$/, "已选择 $1 个媒体"], [/^Edit (.+)$/, "编辑 $1"], [/^Children of (.+)$/, "$1 的子菜单"],
  [/^Move (.+) up$/, "上移 $1"], [/^Move (.+) down$/, "下移 $1"], [/^Enable (.+)$/, "启用 $1"],
];

function translate(value: string) {
  const trimmed = value.trim();
  if (exact[trimmed]) return value.replace(trimmed, exact[trimmed]);
  for (const [pattern, replacement] of phrases) if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, replacement));
  return value;
}

function localize(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.parentElement && !["SCRIPT", "STYLE", "TEXTAREA"].includes(node.parentElement.tagName)) node.nodeValue = translate(node.nodeValue ?? "");
    node = walker.nextNode();
  }
  if (root instanceof Element) for (const attr of ["placeholder", "aria-label", "title"]) if (root.hasAttribute(attr)) root.setAttribute(attr, translate(root.getAttribute(attr) ?? ""));
  root.querySelectorAll?.("[placeholder],[aria-label],[title]").forEach((element) => {
    for (const attr of ["placeholder", "aria-label", "title"]) if (element.hasAttribute(attr)) element.setAttribute(attr, translate(element.getAttribute(attr) ?? ""));
  });
}

export function AdminChinese() {
  useEffect(() => {
    localize(document.body);
    const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node instanceof Element) localize(node);
      else if (node.nodeType === Node.TEXT_NODE) node.nodeValue = translate(node.nodeValue ?? "");
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
