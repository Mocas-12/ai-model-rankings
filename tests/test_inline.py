"""校验 Streamlit 内联改写规则仍然命中 index.html（CI 零依赖：python3 tests/test_inline.py）。"""
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
from build import build_html
import build

html = build_html()
assert 'href="css/style.css"' not in html, "style.css 未被内联"
for js in ("app", "tools", "card"):
    assert f'src="js/{js}.js"' not in html, f"{js}.js 未被内联"
assert "vendor/echarts" not in html, "echarts 未替换为 CDN"
assert 'integrity="sha384-' in html, "CDN ECharts 缺少 SRI"
assert html.count("<style>") >= 1, "内联样式缺失"
assert 'rel="manifest"' not in html, "内联版不应带 manifest（Streamlit iframe 无法安装 PWA）"
assert 'apple-touch-icon' not in html, "内联版不应带 apple-touch-icon"

# Cloud 拉取静态文件后只重跑 app.py：构建必须读取新资源，不能复用 import 时的内容。
with TemporaryDirectory() as temp_dir:
    root = Path(temp_dir)
    (root / "index.html").write_text((build.ROOT / "index.html").read_text(encoding="utf-8"), encoding="utf-8")
    assets = ("css/style.css", "js/app.js", "js/tools.js", "js/card.js")
    for asset in assets:
        path = root / asset
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"/* first:{asset} */", encoding="utf-8")
    with patch.object(build, "ROOT", root):
        first = build_html()
        for asset in assets:
            assert f"first:{asset}" in first, f"{asset} 未从当前资源目录读取"
            (root / asset).write_text(f"/* updated:{asset} */", encoding="utf-8")
        updated = build_html()
        for asset in assets:
            assert f"updated:{asset}" in updated, f"{asset} 仍使用上次构建的旧内容"
            assert f"first:{asset}" not in updated, f"{asset} 旧内容未清除"

print(f"inline rewrites and asset refresh ok · {len(html)} bytes")
