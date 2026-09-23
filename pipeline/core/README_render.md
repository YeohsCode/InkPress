"""HTML → PNG 卡片渲染器（替代单调 PIL 版）。

设计（2026-09-22 用户反馈：布局/色彩太单调）：
- 每页 = 1242×1656 HTML 卡片，CSS 变量控制主题色，色彩分层（背景渐变/强调色块/标签 chips）
- 封面大字 + accent 词高亮；内容页：章节标签 chip + 标题 + 分段正文 + 关键数字高亮
- 支持每卡可选配图 card.image（本地路径或 URL），无图自动排版补位
- 截图用 HermesAgent 自带 node playwright（chromium），设备缩放 2x
- 图片不带参考资料 ref（ref 只进正文，见 report.json.references）

用法: node pipeline/core/render_html.js [report.json路径]
"""
