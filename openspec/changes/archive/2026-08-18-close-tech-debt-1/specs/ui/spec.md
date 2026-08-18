## ADDED Requirements

### Requirement: marketing 物料单测覆盖
marketing 14 组件（Hero/CTA/ContentList/Testimonial/LeadCapture/Navbar/Footer/FeatureGrid/Stats/FAQ/Pricing/TestimonialCarousel/Gallery/LogoCloud）SHALL 各有单测（默认渲染 + 核心 props + slot 最小集）。

#### Scenario: 组件测试存在
- **WHEN** 列出 test/unit 下 marketing 相关 spec
- **THEN** 14 组件均有对应文件且通过

### Requirement: 脚手架残留清理
NxWelcome 等脚手架残留与 .gitkeep 占位 SHALL 从 ui 包移除。

#### Scenario: 无死文件
- **WHEN** 全局搜索 NxWelcome 引用
- **THEN** 零命中且文件已删除
