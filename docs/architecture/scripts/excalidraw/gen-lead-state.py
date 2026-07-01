#!/usr/bin/env python3
"""生成 Lead 线索状态机图（Excalidraw）。NEW→ASSIGNED→CONTACTING→CONVERTED/LOST/INVALID，含 RECALL 回收。"""
import json, sys

def bp(bg=None, rn=3):
    return {"strokeColor":"#1e1e1e","backgroundColor":bg or "transparent","fillStyle":"solid",
            "strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],
            "roundness":{"type":rn} if rn else None,"seed":None,"version":1,"versionNonce":None,
            "isDeleted":False,"boundElements":[],"updated":1,"link":None,"locked":False,"angle":0}
def box(i,x,y,w,h,bg): e=bp(bg,3);e.update({"type":"rectangle","id":i,"x":x,"y":y,"width":w,"height":h});return e
def ell(i,x,y,w,h,bg): e=bp(bg,2);e.update({"type":"ellipse","id":i,"x":x,"y":y,"width":w,"height":h});return e
def lbl(i,x,y,t,s=16,c=None): e=bp(None,None);e["roundness"]=None;e.update({"type":"text","id":i,"x":x,"y":y,"width":80,"height":24,"fontSize":s,"fontFamily":1,"textAlign":"center","verticalAlign":"middle","containerId":c,"text":t,"originalText":t,"lineHeight":1.25,"backgroundColor":"transparent"});return e
def arr(i,x,y,pts,d=False,col="#1e1e1e"):
    e=bp(None,2);e["strokeColor"]=col
    if d:e["strokeStyle"]="dashed"
    e.update({"type":"arrow","id":i,"x":x,"y":y,"width":pts[-1][0],"height":pts[-1][1],"startBinding":None,"endBinding":None,"lastCommittedPoint":None,"startArrowhead":None,"endArrowhead":"arrow","points":pts});return e

P={"start":"#d5e8d4","new":"#a5d8ff","mid":"#fff2cc","on":"#ffe8cc","ok":"#b2f2bb","lost":"#f5f5f5","bad":"#ffc9c9","recall":"#e1d5e7"}
E=[lbl("title",330,15,"Lead 线索状态机（LeadStatusMachine · 非法转移抛 409）",s=22)]
y=175
# 主链
E+=[ell("start",30,y-30,90,60,P["start"]),lbl("startt",42,y-18,"START\n表单提交",s=13,c="start")]
E+=[arr("a0",120,y,[[0,0],[40,0]],col="#82b366")]
chain=[("new","NEW\n新线索",P["new"],170),("assigned","ASSIGNED\n已分配",P["mid"],360),("contacting","CONTACTING\n跟进中",P["on"],550)]
for i,(eid,t,bg,x) in enumerate(chain):
    E+=[box(eid,x,y-40,130,80,bg),lbl(eid+"t",x+25,y-30,t,s=16,c=eid)]
    if i>0:
        px=chain[i-1][3]+130
        E+=[arr(f"a{i}",px,y,[[0,0],[x-px-4,0]],col="#6c8ebf")]
E+=[lbl("l1",200,y-58,"认领",s=12),lbl("l2",390,y-58,"开始跟进",s=12)]
# 终态
E+=[ell("conv",730,y-95,140,70,P["ok"]),lbl("convt",740,y-80,"CONVERTED ★\n已转化",s=15,c="conv")]
E+=[ell("lost",730,y-5,120,60,P["lost"]),lbl("lostt",735,y+8,"LOST\n战败",s=15,c="lost")]
E+=[ell("inv",730,y+75,120,60,P["bad"]),lbl("invt",735,y+88,"INVALID\n无效",s=15,c="inv")]
E+=[arr("ac1",680,y-20,[[0,0],[50,-40]],col="#2d6a2d"),lbl("lc1",690,y-50,"成交",s=12)]
E+=[arr("ac2",680,y,[[0,0],[50,20]],col="#666"),lbl("lc2",690,y+15,"战败",s=12)]
E+=[arr("ac3",680,y+20,[[0,0],[50,70]],col="#b85450"),lbl("lc3",690,y+60,"无效",s=12)]
# RECALL 回收
E+=[box("recall",930,y-15,130,70,P["recall"]),lbl("recallt",935,y-5,"RECALL\n回收站\n(可恢复)",s=13,c="recall")]
E+=[arr("ar1",850,y+25,[[0,0],[80,0]],d=True,col="#666"),lbl("lr1",855,y+5,"回收",s=12)]
E+=[arr("ar2",930,y-15,[[0,0],[-40,-150]],d=True,col="#9673a6"),lbl("lr2",875,y-90,"恢复",s=12)]
# 底部说明
E+=[lbl("note",30,y+170,"🔒 状态机强制合法转移：非定义跳转抛 409；contact 字段 AES-GCM 加密；解密写 lead_audit_logs；去重指纹 dedup_hash=sha256(formId:键)",s=13)]
scene={"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":E,"appState":{"viewBackgroundColor":"#ffffff","gridSize":None},"files":{}}
out=sys.argv[1] if len(sys.argv)>1 else "01-lead-state.excalidraw"
open(out,"w",encoding="utf-8").write(json.dumps(scene,ensure_ascii=False))
print(f"✅ {out}（{len(E)} 元素）")
