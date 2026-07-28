#!/usr/bin/env python3
"""生成三层鉴权链路图（Excalidraw）。B端用户/C端访客→BFF→AI服务校验。"""
import json, sys
def bp(bg=None,rn=3):
    return {"strokeColor":"#1e1e1e","backgroundColor":bg or "transparent","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"roundness":{"type":rn} if rn else None,"seed":None,"version":1,"versionNonce":None,"isDeleted":False,"boundElements":[],"updated":1,"link":None,"locked":False,"angle":0}
def box(i,x,y,w,h,bg): e=bp(bg,3);e.update({"type":"rectangle","id":i,"x":x,"y":y,"width":w,"height":h});return e
def dia(i,x,y,w,h,bg): e=bp(bg,2);e.update({"type":"diamond","id":i,"x":x,"y":y,"width":w,"height":h});return e
def ell(i,x,y,w,h,bg): e=bp(bg,2);e.update({"type":"ellipse","id":i,"x":x,"y":y,"width":w,"height":h});return e
def lbl(i,x,y,t,s=15,c=None):
    e=bp(None,None);e["roundness"]=None;e.update({"type":"text","id":i,"x":x,"y":y,"width":80,"height":24,"fontSize":s,"fontFamily":1,"textAlign":"center","verticalAlign":"middle","containerId":c,"text":t,"originalText":t,"lineHeight":1.25,"backgroundColor":"transparent"});return e
def arr(i,x,y,pts,d=False,col="#1e1e1e"):
    e=bp(None,2);e["strokeColor"]=col
    if d:e["strokeStyle"]="dashed"
    e.update({"type":"arrow","id":i,"x":x,"y":y,"width":pts[-1][0],"height":pts[-1][1],"startBinding":None,"endBinding":None,"lastCommittedPoint":None,"startArrowhead":None,"endArrowhead":"arrow","points":pts});return e

P={"b":"#ffe8cc","c":"#b2f2bb","bff":"#a5d8ff","hdr":"#74c0fc","ai":"#e1d5e7","dec":"#fff2cc","vis":"#ffc9c9","ok":"#b2f2bb","rej":"#ffc9c9"}
E=[lbl("title",330,15,"luban AI · 三层鉴权链路（BFF + 服务间信任）",s=22)]
# 三类调用方
E+=[box("ub",40,90,200,60,P["b"]),lbl("ubt",60,108,"B 端用户 (engine)\nAuthorization: Bearer <JWT>",s=13,c="ub")]
E+=[box("uc",40,180,200,70,P["c"]),lbl("uct",60,198,"C 端访客 (website)\n无 JWT · X-Visitor-Id\n(放行为 visitor role)",s=13,c="uc")]
# BFF
E+=[box("bff",310,110,220,110,P["bff"]),lbl("bfft",340,125,"BFF parseAuthFromRequest()",s=14,c="bff")]
E+=[lbl("bfft2",325,160,"解析 JWT / 读 Visitor-Id\n→ user_id + role",s=13)]
# 附加头
E+=[box("hdr",310,260,220,100,P["hdr"]),lbl("hdrt",330,272,"附加请求头",s=14,c="hdr"),
    lbl("hdrs",325,300,"X-Internal-Token: <共享密钥>\nX-User-Id / X-User-Role",s=12)]
# AI 服务
E+=[box("ai",610,90,180,50,P["ai"]),lbl("ait",640,100,"AI 服务 :8100",s=15,c="ai")]
E+=[dia("dec",610,170,180,140,P["dec"]),lbl("dect",640,200,"校验 token\n合法？",s=15,c="dec"),
    lbl("dec2",625,240,"是→跑 agent\n否→401/4401",s=12,c="dec")]
# visitor 拦截
E+=[box("vis",840,175,220,110,P["vis"]),lbl("vist",860,188,"role == visitor ?",s=14,c="vis"),
    lbl("viss",855,220,"禁用工具调用\n(tool_client=None)\n仅允许生成/引导",s=12,c="vis")]
# 结果
E+=[ell("ok",650,360,120,55,P["ok"]),lbl("okt",660,372,"✅ 放行\n跑 agent",s=14,c="ok")]
E+=[ell("rej",490,360,120,55,P["rej"]),lbl("rejt",505,372,"❌ 拒绝\n401/4401",s=14,c="rej")]
# 连线
E+=[arr("e1",240,120,[[0,0],[70,40]],col="#d79b00")]
E+=[arr("e2",240,215,[[0,0],[70,-20]],col="#82b366")]
E+=[arr("e3",530,160,[[0,0],[80,-30]],col="#6c8ebf")]
E+=[arr("e4",610,115,[[0,0],[0,55]],col="#9673a6")]
E+=[arr("e5",790,240,[[0,0],[50,-20]],col="#6c8ebf")]
E+=[arr("e6",700,310,[[0,0],[-10,50]],col="#2d6a2d"),lbl("l1",670,335,"合法",s=12)]
E+=[arr("e7",610,250,[[-20,0],[-100,110]],col="#b85450"),lbl("l2",500,300,"非法",s=12)]
# 说明
E+=[lbl("note",40,450,"💡 服务间用共享密钥(X-Internal-Token)建立信任，用户身份透传到 AI；AI 不重新校验 JWT，只验服务间 token",s=13)]
scene={"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":E,"appState":{"viewBackgroundColor":"#ffffff","gridSize":None},"files":{}}
out=sys.argv[1] if len(sys.argv)>1 else "10-auth.excalidraw"
open(out,"w",encoding="utf-8").write(json.dumps(scene,ensure_ascii=False))
print(f"✅ {out}（{len(E)} 元素）")
