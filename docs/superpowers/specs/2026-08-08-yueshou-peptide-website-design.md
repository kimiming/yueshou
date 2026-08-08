# 粤首多肽官网与内容管理系统设计规格

## 1. 项目目标

为粤首建设一个面向欧美科研机构和 B2B 客户的多语言多肽官网。网站使用 Next.js App Router 与 Ant Design，参考 `peptide-china.com` 的栏目结构、页面节奏和企业科研视觉风格，但不复制其商标、受版权保护的图片、整段原文或不可验证的企业资质。

品牌英文标语固定为：`Precision Peptide Synthesis for Global Scientific Research`。

项目同时交付可维护正式内容的管理后台，以及两套生产部署方案：

1. Vercel + Supabase PostgreSQL + Cloudflare R2。
2. 自有服务器 Docker Compose：Next.js + PostgreSQL + MinIO + Nginx。

## 2. 范围与交付阶段

项目包含两个边界清晰、共享同一数据模型的子系统：

- 公开官网：多语言页面、产品与新闻、询盘、SEO、Cookie 同意和法律政策页。
- 管理后台：认证、内容编辑、媒体上传、多语言维护、询盘管理、用户角色和审计。

实现顺序为基础设施与数据模型、公开官网、管理后台、双部署配置、端到端验证。每个阶段均产生可独立测试的结果，最终交付同一代码库。

## 3. 技术架构

- 框架：Next.js App Router，TypeScript 严格模式。
- UI：Ant Design，使用可维护主题 Token；前台以服务端组件为主，交互组件按需声明为客户端组件。
- 数据库：PostgreSQL。
- ORM：Prisma，迁移文件纳入版本控制。
- 认证：Auth.js Credentials Provider；用户密码以 Argon2id 哈希保存。
- 表单：Zod 进行服务端输入校验。
- 富文本：后台使用可清理输出的编辑器，保存和渲染时执行白名单消毒。
- 对象存储：统一 `ObjectStorage` 接口；云端使用 Cloudflare R2，私有部署使用 MinIO，二者均通过 S3 兼容 API 工作。
- 测试：Vitest、React Testing Library 和 Playwright。
- 包管理器：项目初始化时选定并保持单一锁文件。

## 4. URL 与多语言策略

公开页面统一使用 `/{locale}/...` 路由，支持：

- `en`：默认语言，必须完整。
- `zh-CN`：简体中文。
- `de`：德语。
- `fr`：法语。
- `es`：西班牙语。

根路径根据明确规则跳转到 `/en`，不使用基于 IP 的不可预测强制跳转。固定界面词汇、按钮、验证提示和 Cookie 控件文案来自 `messages/{locale}.json`。由后台维护的公司介绍、产品、服务、页面区块、文章和法律内容存储在 PostgreSQL 翻译表中。

英文内容是数据库内容的必填回退版本。其他语言缺失时显示英文，并在后台标记为“需要翻译”。每个公开页面输出 canonical 与五语言 `hreflang`，包括 `x-default`。

## 5. 公开官网信息架构

### 5.1 全局框架

- 顶部信息栏：电话、邮箱、语言选择。
- 主导航：Logo、可配置菜单、搜索和询盘按钮。
- 页脚：公司简介、地址与联系方式、快捷导航、服务导航、新闻导航、法律政策入口、Cookie 设置入口和版权信息。
- Cookie Banner：首次访问显示；非必要统计脚本只有在同意后加载，可随时撤回。

### 5.2 首页

首页区块均可在后台启用、禁用、排序和按语言编辑：

1. Hero/Banner：多张轮播图、标题、摘要、主次按钮。
2. 核心服务：Custom Peptide Synthesis、Peptide Modification、Purification & Analysis、Scale-up Manufacturing 等卡片。
3. 公司介绍：原创粤首文案、企业图片和详情入口。
4. 技术能力：合成、纯化、分析和规模化能力。
5. 质量体系：质量控制流程和可验证认证；未提供的认证不得虚构。
6. 产品/服务分类：分类卡片及目标页链接。
7. 全球服务能力：服务范围、交付与支持说明。
8. 数据指标：仅发布经粤首确认的数据。
9. 新闻动态：可设置首页显示数量和置顶文章。
10. 询盘 CTA：跳转 Request a Quote。

视觉参考目标站的蓝色科研企业风、宽屏 Banner、留白和内容节奏。品牌素材必须为粤首自有、已授权或原创生成素材。

### 5.3 主要页面

- About：公司介绍、发展历程、研发能力、质量与认证。
- Services：服务列表与服务详情。
- Products：分类、搜索、筛选、产品列表与详情；可按名称、CAS、序列或应用搜索。
- Quality：质量控制、分析平台、交付流程和合规能力。
- News：文章列表、分类、标签和文章详情。
- Contact：公司地址、电话、邮箱和地图占位配置。
- Request a Quote：公司名、姓名、机构邮箱、国家/地区、需求说明、附件和 GDPR 同意。
- Search：跨产品、服务、页面和新闻的站内搜索结果。

### 5.4 法律与政策页面

页脚必须独立列出：

- Terms of Service。
- Privacy Policy，覆盖 GDPR 数据主体权利、处理目的、法律依据、保存期限、第三方处理方、跨境处理和联系渠道。
- Disclaimer / RUO Policy，明确仅限科研用途，不用于人体、诊断或治疗，不向未成年人或无资质个人销售。
- Shipping & Compliance Notice，说明 FedEx/DHL 等可配置物流方式、买方清关责任与当地法律责任。
- Cookie Policy，列出必要 Cookie、可选统计 Cookie、有效期和撤回机制。

法律文本提供可编辑的五语言版本，上线前必须由目标市场律师审阅；网站不得把模板文案描述为正式法律意见。

## 6. 语义化、SEO 与性能

- 使用 `header`、`nav`、`main`、`section`、`article`、`aside`、`address`、`footer` 等语义标签。
- 每页仅一个与搜索意图匹配的 `h1`，后续标题保持有序层级。
- 服务端生成 title、description、Open Graph、X Card、canonical 和 robots 指令。
- 自动生成多语言 `sitemap.xml` 和 `robots.txt`。
- 输出 `Organization`、`WebSite`、`BreadcrumbList`、`Article` 及适用的 Product/Service JSON-LD。
- 首页和营销页以服务端组件、SSR/ISR 和按标签缓存为主；后台发布后触发精确 `revalidatePath`/`revalidateTag`。
- 新闻与产品详情使用可缓存服务端渲染；草稿和后台页面禁止索引。
- 图片使用 Next.js Image 响应式优化；媒体库强制维护英文 `alt`，其他语言可单独覆盖。
- 字体、首屏图片和客户端包按 Core Web Vitals 目标优化，避免把整页转换为客户端渲染。

## 7. 组件边界

公开组件按职责拆分：

- `SiteHeader`、`PrimaryNavigation`、`LanguageSwitcher`、`SiteFooter`。
- `HeroSection`、`ServicesSection`、`AboutSection`、`CapabilitiesSection`、`QualitySection`、`StatsSection`、`NewsSection`、`CtaSection`。
- `ProductCard`、`ArticleCard`、`Breadcrumbs`、`RichContent`、`SeoJsonLd`。
- `CookieConsentBanner`、`CookiePreferencesDialog`、`QuoteForm`。

组件只接收经验证的视图模型，不在展示层直接访问 Prisma。数据访问集中在服务端 repository/service 边界中，便于测试和替换存储实现。

## 8. 管理后台

后台入口为 `/admin`，公开路由与后台路由使用独立布局。功能包括：

- 登录、退出和安全会话。
- 仪表盘：内容状态、近期询盘、缺失翻译和近期操作。
- 全局设置：Logo、favicon、品牌信息、Slogan、电话、邮箱、地址、社交链接和默认 SEO。
- 导航与页脚：菜单层级、排序、显示状态和链接。
- 首页搭建：区块启停、排序、Banner、服务、优势、指标、CTA 和新闻配置。
- 页面管理：About、Services、Quality、Contact 和法律政策。
- 产品管理：分类、产品字段、媒体、SEO、排序、发布状态。
- 新闻管理：文章、分类、标签、作者、封面、摘要、正文、发布时间和状态。
- 询盘管理：查看、筛选、状态、内部备注和 CSV 导出；保留 GDPR 同意证据。
- 媒体库：上传、替换、删除、尺寸信息、替代文本和引用检查。
- 多语言编辑：五语言标签页，英文必填，翻译完整度可见。
- 用户与角色：`ADMIN` 和 `EDITOR`。
- 审计日志：记录登录、创建、修改、发布、归档和删除。

危险删除默认采用可恢复的软删除或归档。正在被页面引用的媒体不得直接物理删除。

## 9. 核心数据模型

主要实体：

- `User`、`AccountSession`、`AuditLog`。
- `SiteSetting`、`SiteSettingTranslation`。
- `NavigationItem`、`NavigationItemTranslation`。
- `Page`、`PageTranslation`、`PageSection`、`PageSectionTranslation`。
- `Service`、`ServiceTranslation`。
- `ProductCategory`、`ProductCategoryTranslation`、`Product`、`ProductTranslation`。
- `ArticleCategory`、`ArticleCategoryTranslation`、`Article`、`ArticleTranslation`、`Tag`。
- `MediaAsset`、`MediaAssetTranslation`。
- `Inquiry`、`InquiryAttachment`、`ConsentRecord`。
- `CookieCategory`、`CookieDefinition`。

翻译表使用实体 ID 与 locale 联合唯一约束。可发布实体使用 `DRAFT`、`PUBLISHED`、`ARCHIVED` 状态，并记录 `publishedAt`。页面区块通过稳定的 section type 与经过 Zod 校验的结构化配置表达；不可执行任意代码。

## 10. 数据流与缓存

1. 管理员提交表单。
2. Server Action/API Route 验证会话、角色、CSRF 和 Zod schema。
3. service 层在数据库事务中写入内容与审计日志。
4. 媒体上传通过预签名 URL 直传 R2/MinIO，完成后由服务端确认元数据。
5. 发布操作触发与实体相关的路径和标签失效。
6. 公开页面在服务端取得已发布内容，将数据库翻译与 JSON 固定词汇合并为视图模型。
7. React 服务端组件输出完整 HTML，客户端仅接管轮播、菜单、表单和 Cookie 控件等交互岛。

## 11. 安全与隐私

- Argon2id 密码哈希、安全 Cookie、会话轮换和登录限流。
- 服务端角色授权；隐藏按钮不作为授权手段。
- 写操作校验 Origin/CSRF，输入使用 Zod，富文本使用白名单消毒。
- 上传限制 MIME、扩展名、体积和图片尺寸；对象使用随机键名。
- 询盘和后台接口设置分层限流，日志不得记录密码、会话令牌或完整敏感表单内容。
- Cookie 默认仅启用必要类别；分析脚本需明确同意。
- ConsentRecord 保存政策版本、同意类别、时间和必要的最小证据。
- 提供访问、更正、删除和撤回请求的联系渠道及后台处理状态。
- 数据备份加密并设置保留周期；恢复流程需在上线前演练。

## 12. 部署设计

### 12.1 云端部署

- Vercel：Next.js 应用与环境变量。
- Supabase：PostgreSQL，使用生产连接池配置。
- Cloudflare R2：公开或签名媒体对象。
- 数据库迁移在受控发布步骤执行，不在每个 Web 实例启动时并发执行。

### 12.2 自有服务器部署

交付 `docker-compose.yml`，包含：

- `web`：Next.js standalone 生产镜像。
- `postgres`：固定主版本、健康检查和持久化卷。
- `minio`：S3 兼容对象存储和持久化卷。
- `nginx`：TLS 终止、反向代理、上传限制和安全响应头。
- `migrate`：一次性 Prisma 迁移服务。
- `backup`：每日 PostgreSQL 与对象存储备份任务，备份路径使用独立持久化卷或外部目标。

服务仅暴露 Nginx 的 80/443；PostgreSQL 和 MinIO 管理端默认不暴露公网。配置包括 `.env.example`、健康检查、启动依赖、重启策略、日志限制和恢复说明。

## 13. 错误处理

- 公开页面：内容不存在返回语义正确的 404；数据库短暂失败显示通用错误页并记录结构化错误。
- 表单：字段错误就地展示；网络或服务错误保留用户已填写数据并提供重试。
- 后台：并发编辑使用更新时间或版本字段检测冲突，避免静默覆盖。
- 上传：失败对象不创建有效媒体记录；孤立临时对象由清理任务处理。
- 发布：缺少英文必填内容、slug 冲突或非法区块配置时拒绝发布并显示具体字段。
- 语言回退：数据库业务内容缺少本地化版本时回退英文；法律页面在未确认翻译时显示英文并明确语言回退。

## 14. 测试与验收

### 14.1 单元与集成测试

- Zod schema、locale 解析与英文回退。
- 角色权限、密码验证、登录限流和审计日志。
- 发布状态、slug 唯一性和缓存标签计算。
- JSON-LD、metadata、canonical、hreflang、robots 和 sitemap。
- Cookie 同意状态及可选脚本加载门控。
- 对象存储适配器针对 R2/MinIO 的契约测试。

### 14.2 端到端测试

- 五语言首页与语言切换。
- Cookie 首次拒绝、接受和撤回。
- 询盘提交、校验和后台查看。
- 管理员登录、文章创建、翻译、发布及前台更新。
- Logo、Banner、导航和公司联系方式修改后前台生效。
- 产品搜索与详情页。
- 法律政策页可从页脚独立访问。

### 14.3 部署与质量验收

- 生产构建成功，Prisma 迁移可在空数据库执行。
- Docker Compose 在新服务器配置下可启动并通过健康检查。
- PostgreSQL 和 MinIO 数据在容器重建后保留。
- 备份可恢复到独立测试环境。
- 桌面、平板和手机关键页面无横向溢出。
- 键盘导航、焦点状态、表单标签、颜色对比度和图片 alt 通过检查。
- 未登录用户不能访问后台数据或写接口。
- 页面源 HTML 包含主要标题、正文、链接和结构化数据，无需运行客户端 JavaScript即可被爬取。

## 15. 内容与品牌约束

- 不复制参考公司的商标、受版权保护图片或整段原文。
- 不把参考公司的认证、专利、客户、产能、地址或经营数据描述为粤首事实。
- 未收到的粤首事实使用后台可编辑且不会误导访客的占位内容，并保持为草稿或明确通用描述。
- 开发阶段使用原创生成或明确授权的科研视觉素材；用户提供自有素材后可从媒体库替换。
- 地址、电话、邮箱、证书和运输承诺在正式发布前由粤首确认。

## 16. 非目标

首期不包含在线支付、消费者购物车、ERP/CRM 双向同步、实验室订单追踪、自动机器翻译或多组织租户。询盘导出为 CSV；未来对接 CRM 时通过独立集成层扩展。

## 17. 成功标准

1. 访客可使用五种语言浏览首页、核心业务、产品、新闻、联系及全部法律页面。
2. Google 可从服务端 HTML 获取关键内容、metadata、结构化数据和语言关系。
3. 授权人员可在后台维护 Logo、Banner、页面区块、导航、页脚、公司信息、产品、新闻和法律文本。
4. 内容发布后无需重新部署即可在公开站生效。
5. 同一代码库可在推荐云端架构和自有服务器 Docker 架构运行。
6. 非必要 Cookie 在同意前不加载，询盘保留可审计的 GDPR 同意记录。
7. 自动测试覆盖关键授权、内容发布、语言、SEO、Cookie、询盘和双存储适配器行为。
