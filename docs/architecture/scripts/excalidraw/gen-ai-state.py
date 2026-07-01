#!/usr/bin/env python3
"""生成 luban AI Agent 状态机图（Excalidraw scene JSON）。

手绘风状态机：START→understand→tool_call→retrieve→generate→validate(菱形)
validate 失败→feedback→generate（回环），通过→hitl→applied/rejected/failed
"""
import json, sys
import importlib.util
spec = importlib.util.spec_from_file_location("gcl", __file__.replace("gen-ai-state.py", "gen-core-loop.py"))
# 直接复用 gen-core-loop 的绘图原语：重新定义一套，避免循环 import

PALETTE = {
    "start": "#d5e8d4",   # 绿
    "ai": "#e1d5e7",      # 紫
    "tool": "#dae8fc",    # 蓝
    "decision": "#fff2cc",# 黄
    "loop": "#ffc9c9",    # 红
    "hitl": "#ffe8cc",    # 橙
    "end_ok": "#b2f2bb",  # 绿
    "end_no": "#f5f5f5",  # 灰
    "end_bad": "#ffc9c9", # 红
}

def bp(bg=None, roundness=3):
    return {"strokeColor": "#1e1e1e", "backgroundColor": bg or "transparent",
            "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
            "roughness": 1, "opacity": 100, "groupIds": [],
            "roundness": {"type": roundness} if roundness else None,
            "seed": None, "version": 1, "versionNonce": None, "isDeleted": False,
            "boundElements": [], "updated": 1, "link": None, "locked": False, "angle": 0}

def box(eid, x, y, w, h, bg):
    e = bp(bg, 3); e.update({"type": "rectangle", "id": eid, "x": x, "y": y, "width": w, "height": h}); return e

def diamond(eid, x, y, w, h, bg):
    e = bp(bg, 2); e.update({"type": "diamond", "id": eid, "x": x, "y": y, "width": w, "height": h}); return e

def ellipse(eid, x, y, w, h, bg):
    e = bp(bg, 2); e.update({"type": "ellipse", "id": eid, "x": x, "y": y, "width": w, "height": h}); return e

def label(eid, x, y, text, size=16, container=None):
    e = bp(None, None); e["roundness"] = None
    e.update({"type": "text", "id": eid, "x": x, "y": y, "width": 80, "height": 24,
              "fontSize": size, "fontFamily": 1, "textAlign": "center", "verticalAlign": "middle",
              "containerId": container, "text": text, "originalText": text, "lineHeight": 1.25,
              "backgroundColor": "transparent"})
    return e

def arrow(eid, x, y, points, dashed=False, color="#1e1e1e"):
    e = bp(None, 2); e["strokeColor"] = color
    if dashed: e["strokeStyle"] = "dashed"
    e.update({"type": "arrow", "id": eid, "x": x, "y": y,
              "width": points[-1][0], "height": points[-1][1],
              "startBinding": None, "endBinding": None, "lastCommittedPoint": None,
              "startArrowhead": None, "endArrowhead": "arrow", "points": points})
    return e

elements = []

# 标题
elements.append(label("title", 380, 20, "luban AI Agent · 状态机（一句话 → 合法页面）", size=24))

# 主流程横向：5 个节点
# y 中心 = 180, 节点高 110, 宽 150
y = 180
nodes = [
    ("n1", "understand", "意图分类\ngenerate_page/\nedit_property/...", "ai"),
    ("n2", "tool_call", "读业务数据\nget_page_schema/\nlist_leads\n(经 BFF 回环)", "tool"),
    ("n3", "retrieve", "RAG 召回\nQdrant hybrid\ntop-k 物料", "tool"),
    ("n4", "generate", "LLM 生成\n物料+schema+\n需求→PageSchema", "ai"),
]
nw, gap = 170, 30
x0 = 130
centers = {}
for i, (eid, t, sub, cat) in enumerate(nodes):
    x = x0 + i * (nw + gap)
    centers[eid] = x + nw / 2
    elements.append(box(eid, x, y - 55, nw, 110, PALETTE[cat]))
    elements.append(label(f"{eid}t", x + nw/2 - 40, y - 45, t, size=17, container=eid))
    elements.append(label(f"{eid}s", x + 12, y - 10, sub, size=12))

# validate 菱形（决策）
vx = x0 + 4 * (nw + gap)
vw, vh = 170, 130
centers["n5"] = vx + vw / 2
elements.append(diamond("n5", vx, y - 65, vw, vh, PALETTE["decision"]))
elements.append(label("n5t", vx + vw/2 - 40, y - 50, "validate", size=17, container="n5"))
elements.append(label("n5s", vx + vw/2 - 40, y - 22, "六重校验闸", size=13, container="n5"))

# 主流程箭头
for a, b in [("n1","n2"),("n2","n3"),("n3","n4"),("n4","n5")]:
    ax = centers[a] + (nw/2 if a!="n5" else vw/2)
    bx = centers[b] - (nw/2 if b!="n5" else vw/2)
    elements.append(arrow(f"e_{a}_{b}", ax, y, [[0,0],[bx-ax-4,0]], color="#9673a6"))

# START
sx = 40
elements.append(ellipse("start", sx, y - 35, 80, 70, PALETTE["start"]))
elements.append(label("startt", sx + 40 - 24, y - 14, "START\n用户消息", size=14, container="start"))
elements.append(arrow("e_start_n1", sx + 78, y, [[0,0],[x0 - sx - 82, 0]], color="#82b366"))

# feedback 回环节点（generate 上方）
fy = y - 150
fx = centers["n4"] - 75
elements.append(box("feedback", fx, fy, 150, 50, PALETTE["loop"]))
elements.append(label("feedbackt", fx + 75 - 40, fy + 13, "feedback 失败重试", size=14, container="feedback"))
# validate 失败 → feedback（向上）
elements.append(arrow("e_n5_feedback", centers["n5"], y - 65, [[0,0],[fx+75 - centers["n5"], fy+50 - (y-65)]], dashed=True, color="#b85450"))
elements.append(label("lbfail", centers["n5"] - 10, y - 90, "失败", size=13))
# feedback → generate（向下回环）
elements.append(arrow("e_feedback_n4", fx + 75, fy + 50, [[0,0],[centers["n4"]-(fx+75), (y-55)-(fy+50)]], dashed=True, color="#b85450"))
elements.append(label("lbretry", fx + 90, fy + 80, "带错误重试\n(≤3次)", size=12))

# hitl（validate 通过向下）
hx = centers["n5"] - 70
hy = y + 110
elements.append(box("hitl", hx, hy, 140, 55, PALETTE["hitl"]))
elements.append(label("hitlt", hx + 70 - 40, hy + 15, "hitl 待确认", size=15, container="hitl"))
elements.append(arrow("e_n5_hitl", centers["n5"], y + 65, [[0,0],[hx+70 - centers["n5"], hy - (y+65)]], color="#2d6a2d"))
elements.append(label("lbpass", centers["n5"] + 10, y + 75, "通过", size=13))

# 终态：applied / rejected / failed
ey = hy + 130
applied_x = hx - 30
elements.append(ellipse("applied", applied_x, ey, 130, 60, PALETTE["end_ok"]))
elements.append(label("appliedt", applied_x + 65 - 36, ey + 8, "✅ applied\nschema 落画布", size=14, container="applied"))

rejected_x = hx + 130
elements.append(ellipse("rejected", rejected_x, ey, 120, 60, PALETTE["end_no"]))
elements.append(label("rejectedt", rejected_x + 60 - 36, ey + 12, "rejected\n用户拒绝", size=14, container="rejected"))

failed_x = rejected_x + 140
elements.append(ellipse("failed", failed_x, ey, 110, 60, PALETTE["end_bad"]))
elements.append(label("failedt", failed_x + 55 - 30, ey + 12, "failed\n重试耗尽", size=14, container="failed"))

elements.append(arrow("e_hitl_applied", hx + 40, hy + 55, [[0,0],[applied_x+65-(hx+40), ey-(hy+55)]], color="#2d6a2d"))
elements.append(arrow("e_hitl_rejected", hx + 100, hy + 55, [[0,0],[rejected_x+60-(hx+100), ey-(hy+55)]], color="#666"))

# 单属性编辑跳过HITL（虚线直接到applied）
elements.append(arrow("e_n5_applied", centers["n5"]+vw/2, y, [[0,0],[applied_x+65-(centers["n5"]+vw/2), ey+30-y]], dashed=True, color="#2d6a2d"))
elements.append(label("lbskip", centers["n5"] + vw/2 + 10, y + 30, "单属性编辑\n跳过HITL", size=12))

# 顶部说明（Guardrail + SessionStatus）
elements.append(label("note1", 40, 360, "🛡️ 三重 Guardrail：输入 injection 检测 + PII 脱敏 → LLM；输出校验闸兜底；表达式沙箱对齐引擎", size=13))
elements.append(label("note2", 40, 390, "✅ 核心保证：校验失败必回环重试，AI 不产生坏页面；产物必经 HITL 确认才落画布", size=13))
elements.append(label("note3", 40, 420, "📋 SessionStatus：idle → generating → awaiting_confirm → applied | rejected | failed", size=13))

scene = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com",
         "elements": elements,
         "appState": {"viewBackgroundColor": "#ffffff", "gridSize": None}, "files": {}}

out = sys.argv[1] if len(sys.argv) > 1 else "10-ai-state-machine.excalidraw"
with open(out, "w", encoding="utf-8") as f:
    json.dump(scene, f, ensure_ascii=False)
print(f"✅ 生成 {out}（{len(elements)} 元素）")
