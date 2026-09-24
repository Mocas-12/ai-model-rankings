"""墨榜 · AI 大模型实时战力谱 — Streamlit 入口

站点本体是纯静态页面（index.html + css + js，浏览器直连 OpenRouter 接口），
本文件把它作为全宽组件内嵌到 Streamlit 中：读取页面文件、内联样式与脚本、
隐藏 Streamlit 自带界面。Streamlit iframe 里相对路径不可用，故样式与脚本
就地内联、ECharts 换成 jsdelivr CDN（带 SRI）；页面通过 frameElement
自适应同步 iframe 高度（见 js/app.js 末尾的 fitFrame）。
"""
import re
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="墨榜 · AI 大模型实时战力谱",
    page_icon="🏆",
    layout="wide",
    initial_sidebar_state="collapsed",
)

ROOT = Path(__file__).parent
html = (ROOT / "index.html").read_text(encoding="utf-8")

# index.html 里的本地资源引用 → 内联/CDN。repl 一律走 lambda（内容含 \ 与分组符，
# 直接传字符串会被 re 解释）；断言每条规则恰好命中 1 次，标签一旦漂移在启动时
# 立刻报错，而不是部署出一个 404 裸页。
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
    (r'<script src="vendor/echarts\.min\.js"[^>]*></script>', ECHARTS_CDN),
]
for pattern, repl in REWRITES:
    html, n = re.subn(pattern, lambda _m: repl, html)
    if n != 1:
        raise RuntimeError(
            f"index.html 结构漂移：规则 {pattern!r} 命中 {n} 次（预期 1 次），"
            "请同步更新 app.py 的改写规则"
        )

# 隐藏 Streamlit 自带的菜单/页脚/留白，让画卷铺满
st.markdown(
    """<style>
    #MainMenu, footer {visibility: hidden !important;}
    [data-testid="stHeader"] {display: none !important;}
    .block-container {padding-top: .5rem; padding-bottom: 0; max-width: 100%;}
    body {background: #1d1a15;}
    </style>""",
    unsafe_allow_html=True,
)

# 内嵌页面：初始给个较小高度，页面自身的 fitFrame 会在 1.5s 内撑到真实高度
components.html(html, height=900, scrolling=False)
