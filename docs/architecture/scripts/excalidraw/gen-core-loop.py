#!/usr/bin/env python3
"""生成 luban 核心闭环 7 步图（Excalidraw scene JSON）。

手绘风，7 个步骤横向排列，运营区(1-3)与访客区(5-7)用分隔虚线，
箭头串联，标题在顶部。
"""
import json

PALETTE = {
    "运营": "#ffec99",   # 黄
    "过渡": "#a5d8ff",   # 蓝
    "访客": "#b2f2bb",   # 绿
    "终点": "#ffc9c9",   # 红
    "线": "#1e1e1e",
}

def base_props(bg=None, roundness=3):
    p = {
        "strokeColor": "#1e1e1e", "backgroundColor": bg or "transparent",
        "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
        "roughness": 1, "opacity": 100, "groupIds": [],
        "roundness": {"type": roundness} if roundness else None,
        "seed": None, "version": 1, "versionNonce": None, "isDeleted": False,
        "boundElements": [], "updated": 1, "link": None, "locked": False,
        "angle": 0,
    }
    return p

def box(eid, x, y, w, h, bg):
    e = base_props(bg, 3)
    e.update({"type": "rectangle", "id": eid, "x": x, "y": y, "width": w, "height": h})
    return e

def diamond(eid, x, y, w, h, bg):
    e = base_props(bg, 2)
    e.update({"type": "diamond", "id": eid, "x": x, "y": y, "width": w, "height": h})
    return e

def ellipse(eid, x, y, w, h, bg):
    e = base_props(bg, 2)
    e.update({"type": "ellipse", "id": eid, "x": x, "y": y, "width": w, "height": h})
    return e

def label(eid, x, y, text, size=18, color="#1e1e1e", container=None, bold=False):
    e = base_props(None, None)
    e["roundness"] = None
    e.update({
        "type": "text", "id": eid, "x": x, "y": y,
        "width": 80, "height": 24, "fontSize": size, "fontFamily": 1,
        "textAlign": "center", "verticalAlign": "middle",
        "containerId": container, "text": text, "originalText": text,
        "lineHeight": 1.25, "backgroundColor": "transparent",
    })
    return e

def arrow(eid, x, y, points, dashed=False, color="#1e1e1e"):
    e = base_props(None, 2)
    e["strokeColor"] = color
    if dashed:
        e["strokeStyle"] = "dashed"
    e.update({
        "type": "arrow", "id": eid, "x": x, "y": y,
        "width": points[-1][0], "height": points[-1][1],
        "startBinding": None, "endBinding": None, "lastCommittedPoint": None,
        "startArrowhead": None, "endArrowhead": "arrow", "points": points,
    })
    return e

elements = []

# 标题
elements.append(label("t0", 360, 20, "luban 核心价值闭环（端到端 7 步）", size=26, bold=True))

# 7 个步骤：y=120, 每个宽150, 间距15
steps = [
    ("s1", "① 搭页", "拖拽 / AI 生成", "运营"),
    ("s2", "② 配表单", "留资字段+去重", "运营"),
    ("s3", "③ 发布", "status=published", "运营"),
    ("s4", "④ 短链", "channel+UTM", "过渡"),
    ("s5", "⑤ 投放", "广告/社媒/公众号", "访客"),
    ("s6", "⑥ 访客留资", "表单→Lead\n加密+去重+审计", "访客"),
    ("s7", "⑦ 线索中心", "认领/流转/看转化", "终点"),
]

box_w, box_h, gap = 160, 95, 18
start_x = 30
y = 130
positions = []
for i, (eid, title, sub, cat) in enumerate(steps):
    x = start_x + i * (box_w + gap)
    positions.append((x, x + box_w))
    bg = PALETTE[cat]
    elements.append(box(eid, x, y, box_w, box_h, bg))
    # 标题文字（容器中心）
    tx = x + box_w / 2 - 40
    elements.append(label(f"{eid}t", tx, y + 18, title, size=18, container=eid))
    # 副文字
    elements.append(label(f"{eid}s", x + 8, y + 52, sub, size=12))

# 步骤间箭头
for i in range(6):
    (x1, _), (x2, _) = positions[i], positions[i+1]
    elements.append(arrow(f"a{i}", x1 + 2, y + box_h/2, [[0, 0], [gap - 4, 0]]))

# 运营/访客区分隔（在 s4 和 s5 之间画虚线）
# s4 结束位置 = positions[3][1], s5 开始 = positions[4][0]
div_x = (positions[3][1] + positions[4][0]) / 2
div = base_props(None, None)
div["roundness"] = None
div["strokeStyle"] = "dotted"
div["strokeColor"] = "#999999"
div["strokeWidth"] = 1
div.update({
    "type": "line", "id": "divider", "x": div_x, "y": 95,
    "width": 0, "height": 170, "points": [[0, 0], [0, 170]],
    "startBinding": None, "endBinding": None, "lastCommittedPoint": None,
    "startArrowhead": None, "endArrowhead": None,
})
elements.append(div)

# 区间标签
elements.append(label("cap_op", positions[0][0], 95, "运营侧", size=14, color="#d97900"))
elements.append(label("cap_visit", positions[4][0], 95, "访客侧（终端用户）", size=14, color="#2b8a3e"))

# 底部说明
elements.append(label("note", start_x, y + box_h + 40,
                      "💡 这 7 步都有真实功能支撑，把「搭页」与「留资→转化→归因」打通，是 luban 区别于通用建站/低代码的核心",
                      size=13))

scene = {
    "type": "excalidraw", "version": 2, "source": "https://excalidraw.com",
    "elements": elements,
    "appState": {"viewBackgroundColor": "#ffffff", "gridSize": None},
    "files": {},
}

import sys
out = sys.argv[1] if len(sys.argv) > 1 else "08-core-loop.excalidraw"
with open(out, "w", encoding="utf-8") as f:
    json.dump(scene, f, ensure_ascii=False)
print(f"✅ 生成 {out}（{len(elements)} 元素）")
