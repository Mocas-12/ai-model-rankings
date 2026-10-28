# 墨榜 design system

Hallmark v2.0.0, full redesign, app scope. Baseline: 3a53304dd07f1c032f1b5bf5109f8bd90ce3d595.

## Identity
Keep the ink-brown surface, 墨榜 name, calligraphic wordmark and cinnabar seal. The product is the model data; decorative mountains, sun and brush-line are visually suppressed. The wordmark uses the existing brush font with local KaiTi fallback. All labels, controls, data and section headings use the system reading face.

## System
Color and typography tokens live in css/style.css. Existing provider chart pigments are preserved as named provider tokens, including the explicitly recorded Hallmark 74 waiver for Qwen. Composite model-summary controls retain their full keyboard-accessible hit area under waiver 39b. Canvas chart styles read those same CSS tokens. Use a 4px spacing scale, 40px desktop buttons, 44px touch controls and tabular numerals.

The overview is a compact masthead and an unboxed four-stat strip. Sections use editorial dividers rather than a stack of bordered containers. Every chart keeps its original data, filters, labels and units. Cost and speed remain adjacent on wide screens. The mobile layout stacks existing sections and uses horizontal tab strips; no page or chart is removed.

## States and interactions
Keep the existing data loading, source failure, model search, category tabs, tool selection, modal, install prompt, keyboard and focus behavior. Model detail metrics use a readable grid without nested cards. The Streamlit wrapper continues to inline the same assets through build.py; do not duplicate the UI in app.py. Preserve iframe anchor and auto-height behavior.

## Copy
The original product facts remain. Middle-dot and dash decorations became punctuation; section descriptions moved out of heading tags into adjacent paragraphs while retaining their ids. No new rankings, testimonials or metrics were introduced.

## Review
Existing fixture replay is used for deterministic before/after screenshots. Remote font requests are blocked in that replay, so both versions show the local KaiTi fallback consistently; the production font links remain. Browser screenshots are review artifacts outside the repository. Live upstream freshness is a separate network check, not a condition for layout verification.

Run npm run lint, npm test, python tests/test_inline.py, and Hallmark sloplint --scope app --genre editorial --render --kept. Tests cover model search, keyboard dialogs, tools, 320/390/640/900/1440 widths, standalone anchors and Streamlit srcdoc navigation.
