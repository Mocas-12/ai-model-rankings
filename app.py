"""墨榜 · AI 大模型实时战力谱 — Streamlit 入口

站点本体是纯静态页面（index.html + css + js，浏览器直连 OpenRouter 接口），
本文件把它作为全宽组件内嵌到 Streamlit 中：页面改写逻辑在 build.py
（无 streamlit 依赖，tests/test_inline.py 在 CI 里直接校验它），此处只负责
隐藏 Streamlit 自带界面并内嵌。页面通过 frameElement 自适应同步 iframe
高度（见 js/app.js 末尾的 fitFrame）。
"""
import streamlit as st
import streamlit.components.v1 as components

from build import build_html

st.set_page_config(
    page_title="墨榜 · AI 大模型实时战力谱",
    page_icon="🏆",
    layout="wide",
    initial_sidebar_state="collapsed",
)

html = build_html()

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
