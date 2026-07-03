"""内置物料清单(P0-5 修复)。

从 luban-low-code/src/materials/*/material.ts 抽取的 61 个物料 name + category + description。
用途:
1. 填充 MaterialRegistry(generate 节点拿到真实物料名,不再瞎编)
2. 启动时同步到 Qdrant(RAG 检索物料知识)

更新方式:重新运行抽取脚本(见 scripts/extract_materials.py 或手动从 luban-low-code 提取)。
"""

from __future__ import annotations

from app.rag.sync_materials import MaterialDoc

# fmt: off
BUILTIN_MATERIALS: list[MaterialDoc] = [
    MaterialDoc(name="LubanBanner", category="content", description="横幅图片,支持链接包装、自定义高度与 object-fit"),
    MaterialDoc(name="LubanButton", category="general", description="通用按钮,支持实心/描边/文本三种变体与主/次/表面三种颜色"),
    MaterialDoc(name="LubanCTA", category="marketing", description="CTA 行动号召横幅,带标题、描述、主/次按钮"),
    MaterialDoc(name="LubanCard", category="website", description="卡片容器,支持标题、描述、配图与链接"),
    MaterialDoc(name="LubanCarousel", category="marketing", description="轮播图"),
    MaterialDoc(name="LubanCheckbox", category="form", description="复选框"),
    MaterialDoc(name="LubanCol", category="layout", description="flex 列:作为 LubanRow 子项,控制弹性增长、基础宽度与自身对齐"),
    MaterialDoc(name="LubanCollapse", category="website", description="折叠面板,多个面板标题/内容展开收起"),
    MaterialDoc(name="LubanContainer", category="layout", description="通用容器:限定最大宽度档位并提供内边距开关,用于页面根级布局"),
    MaterialDoc(name="LubanContentList", category="content", description="CMS 内容列表,绑定 collection 后自动渲染内容卡片网格"),
    MaterialDoc(name="LubanCountdown", category="marketing", description="倒计时"),
    MaterialDoc(name="LubanCoupon", category="marketing", description="优惠券"),
    MaterialDoc(name="LubanDatePicker", category="lead", description="日期选择器(留资表单控件)"),
    MaterialDoc(name="LubanDateRange", category="form", description="日期范围选择器"),
    MaterialDoc(name="LubanDivider", category="website", description="分隔线,支持实线/虚线/点线"),
    MaterialDoc(name="LubanDrawer", category="feedback", description="抽屉:四向滑出面板,visible 受控"),
    MaterialDoc(name="LubanFAQ", category="marketing", description="常见问题手风琴,支持默认展开项"),
    MaterialDoc(name="LubanFeatureGrid", category="marketing", description="特性卡片网格,展示图标、标题与描述"),
    MaterialDoc(name="LubanFooter", category="marketing", description="站点页脚,展示多列链接与版权信息"),
    MaterialDoc(name="LubanForm", category="form", description="表单"),
    MaterialDoc(name="LubanGallery", category="marketing", description="图片画廊网格,支持列数、间距与说明"),
    MaterialDoc(name="LubanHeading", category="website", description="标题文本,支持 H1-H6 层级"),
    MaterialDoc(name="LubanHero", category="marketing", description="Hero 区块,展示眉标、大标题、副标题、主/次 CTA 与背景图"),
    MaterialDoc(name="LubanIcon", category="website", description="图标,按名称渲染内置图标"),
    MaterialDoc(name="LubanImage", category="website", description="图片,支持填充模式与链接跳转"),
    MaterialDoc(name="LubanInput", category="form", description="输入框"),
    MaterialDoc(name="LubanLeadCapture", category="marketing", description="线索采集区块,展示标题、描述与联系方式输入表单(提交生成 lead)"),
    MaterialDoc(name="LubanLink", category="website", description="超链接文本"),
    MaterialDoc(name="LubanList", category="website", description="列表,有序或无序"),
    MaterialDoc(name="LubanLogoCloud", category="marketing", description="客户/合作品牌 Logo 展示条,支持灰度处理"),
    MaterialDoc(name="LubanMenu", category="navigation", description="导航菜单:支持横向/纵向模式与子菜单"),
    MaterialDoc(name="LubanModal", category="feedback", description="模态对话框:标题 + 内容 + 底部操作,visible 受控"),
    MaterialDoc(name="LubanNavBar", category="marketing", description="顶部导航栏"),
    MaterialDoc(name="LubanNavbar", category="marketing", description="顶部导航栏,展示品牌名称与导航链接"),
    MaterialDoc(name="LubanPhoneInput", category="lead", description="手机号输入框(留资表单控件)"),
    MaterialDoc(name="LubanPoster", category="poster", description="海报画布容器"),
    MaterialDoc(name="LubanPosterImage", category="poster", description="海报图片"),
    MaterialDoc(name="LubanPosterText", category="poster", description="海报文本"),
    MaterialDoc(name="LubanPricing", category="marketing", description="定价方案卡片,支持高亮套餐与功能清单"),
    MaterialDoc(name="LubanQRCode", category="poster", description="二维码"),
    MaterialDoc(name="LubanRadioGroup", category="form", description="单选"),
    MaterialDoc(name="LubanRating", category="lead", description="评分控件(留资表单控件)"),
    MaterialDoc(name="LubanRegionSelect", category="lead", description="省/市级联选择(留资表单控件)"),
    MaterialDoc(name="LubanRichText", category="website", description="富文本,渲染 HTML 内容"),
    MaterialDoc(name="LubanRow", category="layout", description="flex 行/列容器:按方向排列子节点,提供对齐、间距与换行控制"),
    MaterialDoc(name="LubanSelect", category="form", description="选择"),
    MaterialDoc(name="LubanShape", category="poster", description="图形(矩形/圆形)"),
    MaterialDoc(name="LubanSidePanel", category="layout", description="侧滑面板:右侧滑出的模态面板,支持 header/body/footer 插槽与 v-model:visible"),
    MaterialDoc(name="LubanSlider", category="lead", description="滑块(留资表单控件)"),
    MaterialDoc(name="LubanStats", category="marketing", description="KPI 数据统计区,展示数值、单位与标签"),
    MaterialDoc(name="LubanSwitch", category="form", description="开关"),
    MaterialDoc(name="LubanTable", category="data-display", description="数据表格:列定义 + 数据源绑定,支持分页/斑马纹/边框"),
    MaterialDoc(name="LubanTabs", category="navigation", description="标签页:支持 line/card/border-card 三种视觉变体"),
    MaterialDoc(name="LubanTagInput", category="form", description="标签输入(回车添加)"),
    MaterialDoc(name="LubanTestimonial", category="marketing", description="评价/社交证明卡片,展示引用、评分与作者信息"),
    MaterialDoc(name="LubanTestimonialCarousel", category="marketing", description="客户评价轮播,自动播放与分页切换"),
    MaterialDoc(name="LubanText", category="general", description="通用文本,支持语义化标签、排版变体与次色样式"),
    MaterialDoc(name="LubanTextArea", category="form", description="多行文本"),
    MaterialDoc(name="LubanTimePicker", category="form", description="时间选择器"),
    MaterialDoc(name="LubanToast", category="feedback", description="全局提示:message/type/duration,命令式触发"),
    MaterialDoc(name="LubanVideo", category="website", description="视频播放器"),
]
# fmt: on


def get_builtin_material_names() -> set[str]:
    """内置物料名集合(供 MaterialRegistry 快速填充)。"""
    return {m.name for m in BUILTIN_MATERIALS}


__all__ = ["BUILTIN_MATERIALS", "get_builtin_material_names"]
