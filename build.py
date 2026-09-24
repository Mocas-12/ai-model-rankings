r"""index.html → Streamlit 内嵌形态的改写逻辑（不依赖 streamlit，供 app.py 与测试共用）。

Streamlit iframe 里相对路径不可用：样式与脚本就地内联、ECharts 换成 jsdelivr
CDN（带 SRI）。repl 一律走 lambda（内容含 \ 与分组符，直接传字符串会被 re
解释）；每条规则断言恰好命中 1 次，index.html 标签一旦漂移立刻报错，
而不是部署出一个 404 裸页。
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
ECHARTS_CDN = (
    '<script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js" '
    'integrity="sha384-pPi0zxBAoDu6+JXW/C68UZLvBUUtU+7zonhif43rqj7pxsGyqyqzcian2Rj37Rss" '
    'crossorigin="anonymous"></script>'
)
REWRITES = [
    (r'<link rel="stylesheet" href="css/style\.css"[^>]*>',
     "<style>" + (ROOT / "css" / "style.css").read_text(encoding="utf-8") + "</style>"),
    (r'<script src="js/app\.js"[^>]*></script>',
     "<script>" + (ROOT / "js" / "app.js").read_text(encoding="utf-8") + "</script>"),
    (r'<script src="js/tools\.js"[^>]*></script>',
     "<script>" + (ROOT / "js" / "tools.js").read_text(encoding="utf-8") + "</script>"),
    (r'<script src="js/card\.js"[^>]*></script>',
     "<script>" + (ROOT / "js" / "card.js").read_text(encoding="utf-8") + "</script>"),
    (r'<script src="vendor/echarts\.min\.js"[^>]*></script>', ECHARTS_CDN),
]


def build_html():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for pattern, repl in REWRITES:
        html, n = re.subn(pattern, lambda _m: repl, html)
        if n != 1:
            raise RuntimeError(
                f"index.html 结构漂移：规则 {pattern!r} 命中 {n} 次（预期 1 次），"
                "请同步更新 build.py 的改写规则"
            )
    return html
