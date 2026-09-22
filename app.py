"""墨榜 · AI 大模型实时战力谱 — Streamlit 入口

站点本体是纯静态页面（index.html + css + js，浏览器直连 OpenRouter 接口），
本文件把它作为全宽组件内嵌到 Streamlit 中：读取页面文件、内联样式与脚本、
隐藏 Streamlit 自带界面，并通过 postMessage 自动同步页面高度。
"""
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
html = html.replace(
    '<link rel="stylesheet" href="css/style.css">',
    "<style>" + (ROOT / "css" / "style.css").read_text(encoding="utf-8") + "</style>",
)
html = html.replace(
    '<script src="js/app.js"></script>',
    "<script>" + (ROOT / "js" / "app.js").read_text(encoding="utf-8") + "</script>",
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
