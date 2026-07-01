#!/usr/bin/env python3
"""生成产品路线图（Excalidraw）。P0→P1→P2(增长/多端)→P3，分阶段依赖。"""
import json, sys
def bp(bg=None,rn=3):
    return {"strokeColor":"#1e1e1e","backgroundColor":bg or "transparent","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"roundness":{"type":rn} if rn else None,"seed":None,"version":1,"versionNonce":None,"isDeleted":False,"boundElements":[],"updated":1,"link":None,"locked":False,"angle":0}
def box(i,x,y,w,h,bg): e=bp(bg,3);e.update({"type":"rectangle","id":i,"x":x,"y":y,"width":w,"height":h});return e
def lbl(i,x,y,t,s=16,c=None):
    e=bp(None,None);e["roundness"]=None;e.update({"type":"text","id":i,"x":x,"y":y,"width":80,"height":24,"fontSize":s,"fontFamily":1,"textAlign":"center","verticalAlign":"middle","containerId":c,"text":t,"originalText":t,"lineHeight":1.25,"backgroundColor":"transparent"});return e
def arr(i,x,y,pts,d=False,col="#1e1e1e"):
    e=bp(None,2);e["strokeColor"]=col
    if d:e["strokeStyle"]="dashed"
    e.update({"type":"arrow","id":i,"x":x,"y":y,"width":pts[-1][0],"height":pts[-1][1],"startBinding":None,"endBinding":None,"lastCommittedPoint":None,"startArrowhead":None,"endArrowhead":"arrow","points":pts});return e

P={"done":"#b2f2bb","doing":"#a5d8ff","plan":"#ffc9c9","multi":"#fff2cc","biz":"#e1d5e7"}
E=[lbl("title",400,15,"luban · 产品路线图（分阶段依赖）",s=24)]
# 主链：P0 → P1 → P2a(增长) → P3；P0 → P2b(多端)；P1 -.-> P2b
y=170
stages=[("p0",50,"P0 · 留资闭环（MVP）","✅ 表单+线索\n✅ 去重 sha256\n✅ 防刷限流",P["done"],155),
        ("p1",260,"P1 · 营销化","✅ 渠道/活动\n✅ 短链系统\n✅ 埋点\n✅ 看板漏斗",P["done"],155),
        ("p2a",470,"P2 · 增长","🚧 A/B 实验\n🚧 流转/触达\n🚧 打分\n🚧 归因",P["doing"],145),
        ("p3",680,"P3 · 商业化","📋 SaaS 计费\n📋 试用/配额\n📋 订阅",P["plan"],155)]
for i,(eid,x,t,sub,bg,h) in enumerate(stages):
    E+=[box(eid,x,y,w:=210,h,bg)]
    E+=[lbl(eid+"t",x+30,y+12,t,s=17,c=eid)]
    E+=[lbl(eid+"s",x+12,y+50,sub,s=13)]
    if i<len(stages)-1:
        nx=stages[i+1][1]
        E+=[arr(f"e{eid}",x+210,y+h/2,[[0,0],[nx-x-214,0]],col=("#2d6a2d" if i<2 else "#b85450"))]
# P2b 多端（下方）
y2=y+220
E+=[box("p2b",260,y2,210,130,P["multi"]),lbl("p2bt",290,y2+12,"P2 · 多端",s=17,c="p2b"),
    lbl("p2bs",272,y2+50,"🚧 Flutter 原生\n🚧 uniapp 小程序\n(依赖 P0/P1 稳定)",s=13)]
E+=[arr("e_p0_p2b",155,y+90,[[0,0],[105,130]],col="#d6b656")]
E+=[lbl("lp0",170,y+140,"依赖基线",s=12)]
E+=[arr("e_p1_p2b",365,y+155,[[0,0],[0,65]],d=True,col="#d6b656")]
# 图例
E+=[lbl("leg",50,y2+150,"✅ 已落地    🚧 进行中    📋 规划中    多端依赖 schema/留资契约稳定后再做",s=14)]
scene={"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":E,"appState":{"viewBackgroundColor":"#ffffff","gridSize":None},"files":{}}
out=sys.argv[1] if len(sys.argv)>1 else "02-roadmap.excalidraw"
open(out,"w",encoding="utf-8").write(json.dumps(scene,ensure_ascii=False))
print(f"✅ {out}（{len(E)} 元素）")
