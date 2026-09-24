"""校验 Streamlit 内联改写规则仍然命中 index.html（CI 零依赖：python3 tests/test_inline.py）。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from build import build_html

html = build_html()
assert 'href="css/style.css"' not in html, "style.css 未被内联"
for js in ("app", "tools", "card"):
    assert f'src="js/{js}.js"' not in html, f"{js}.js 未被内联"
assert "vendor/echarts" not in html, "echarts 未替换为 CDN"
assert 'integrity="sha384-' in html, "CDN ECharts 缺少 SRI"
assert html.count("<style>") >= 1, "内联样式缺失"
print(f"inline rewrites ok · {len(html)} bytes")
