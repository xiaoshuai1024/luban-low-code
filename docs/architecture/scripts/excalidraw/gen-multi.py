#!/usr/bin/env python3
"""生成多端渲染一致性图（Excalidraw）。一份 PageSchema → Web/Flutter/uniapp/Electron 各端渲染器。"""
import json, sys
def bp(bg=None,rn=3):
    return {"strokeColor":"#1e1e1e","backgroundColor":bg or "transparent","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"roundness":{"type":rn} if rn else None,"seed":None,"version":1,"versionNonce":None,"isDeleted":False,"boundElements":[],"updated":1,"link":None,"locked":False,"angle":0}
def box(i,x,y,w,h,bg): e=bp(bg,3);e.update({"type":"rectangle","id":i,"x":x,"y":y,"width":w,"height":h});return e
def lbl(i,x,y,t,s=15,c=None):
    e=bp(None,None);e["roundness"]=None;e.update({"type":"text","id":i,"x":x,"y":y,"width":80,"height":24,"fontSize":s,"fontFamily":1,"textAlign":"center","verticalAlign":"middle","containerId":c,"text":t,"originalText":t,"lineHeight":1.25,"backgroundColor":"transparent"});return e
def arr(i,x,y,pts,d=False,col="#1e1e1e"):
    e=bp(None,2);e["strokeColor"]=col
    if d:e["strokeStyle"]="dashed"
    e.update({"type":"arrow","id":i,"x":x,"y":y,"width":pts[-1][0],"height":pts[-1][1],"startBinding":None,"endBinding":None,"lastCommittedPoint":None,"startArrowhead":None,"endArrowhead":"arrow","points":pts});return e

P={"schema":"#fff2cc","web":"#b2f2bb","fl":"#a5d8ff","uni":"#e1d5e7","elec":"#ffe8cc"}
E=[lbl("title",300,15,"luban · 多端渲染一致性（一份 schema，各端渲染器）",s=21)]
# 顶部 schema
E+=[box("schema",450,60,300,60,P["schema"]),lbl("st",475,75,"📋 PageSchema JSON（SSOT，跨端契约）",s=15,c="schema")]
# 四端
ends=[("web",40,200,"Web (website SSR) ✅",["解析器 JSON→Vue","RuntimeRenderer 递归渲染","物料注册表 type→Vue组件","自研表达式沙箱"],P["web"]),
      ("fl",360,200,"Flutter App 🚧",["解析器 JSON→Dart 对象树","渲染器 递归遍历","物料注册表 type→Widget","luban_flutter_materials"],P["fl"]),
      ("uni",680,200,"uniapp 小程序 📋",["解析器 JSON→对象","渲染器（待实现）","物料注册表","uniapp 物料库（待建）"],P["uni"]),
      ("elec",1000,200,"Electron ✅",["复用 luban-low-code","设计器 + 渲染器","与 Web 同一套实现"],P["elec"])]
for eid,x,y,t,items,bg in ends:
    E+=[box(eid,x,y,270,200,bg),lbl(eid+"t",x+30,y+12,t,s=15,c=eid)]
    for j,it in enumerate(items):
        E+=[lbl(f"{eid}i{j}",x+12,y+50+j*32,it,s=12)]
    # schema → 端 的箭头
    ax=450+150  # schema 中心
    tx=x+135
    E+=[arr(f"e_{eid}",ax,120,[[tx-ax,y-120+0]],d=(eid=="uni"),col=("#82b366" if eid=="web" else "#10739e" if eid=="fl" else "#9673a6" if eid=="uni" else "#d79b00"))]
# 说明
E+=[lbl("note",40,430,"💡 一致性保障：物料 propsSchema 为 SSOT，各端渲染器必须遵守；Dart 类型建议从 TS codegen 生成；表达式走统一沙箱规则",s=13)]
scene={"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":E,"appState":{"viewBackgroundColor":"#ffffff","gridSize":None},"files":{}}
out=sys.argv[1] if len(sys.argv)>1 else "04-multi.excalidraw"
open(out,"w",encoding="utf-8").write(json.dumps(scene,ensure_ascii=False))
print(f"✅ {out}（{len(E)} 元素）")
