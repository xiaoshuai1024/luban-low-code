#!/usr/bin/env python3
# 临时工具：给 luban 直连端口开腾讯云安全组入站规则（域名未备案，IP:端口访问）。
# 凭据读环境变量 TENCENT_SECRET_ID/KEY；实例/地域/端口可由环境变量覆盖。
# 用法： set -a; . .env.prod; set +a;  python deploy/open-sg.py
import os, sys
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.cvm.v20170312 import cvm_client
from tencentcloud.cvm.v20170312 import models as cm
from tencentcloud.vpc.v20170312 import vpc_client
from tencentcloud.vpc.v20170312 import models as vm

REGION = os.environ.get("TENCENT_REGION", "ap-beijing")
INSTANCE_ID = os.environ.get("TENCENT_INSTANCE_ID", "ins-m6yxwwkt")
PORTS = os.environ.get("OPEN_PORTS", "8081,8082").split(",")

try:
    sid = os.environ["TENCENT_SECRET_ID"]
    skey = os.environ["TENCENT_SECRET_KEY"]
except KeyError:
    print("✗ 缺环境变量 TENCENT_SECRET_ID/TENCENT_SECRET_KEY"); sys.exit(1)

cred = credential.Credential(sid, skey)

# 1) 查实例所属安全组
cvm = cvm_client.CvmClient(cred, REGION, ClientProfile())
req = cm.DescribeInstancesRequest()
req.InstanceIds = [INSTANCE_ID]
resp = cvm.DescribeInstances(req)
sg = []
for i in resp.InstanceSet:
    sg.extend(i.SecurityGroupIds)
sg = list(dict.fromkeys(sg))
print(f"instance={INSTANCE_ID} region={REGION} SecurityGroups={sg}")
if not sg:
    print("✗ 未找到安全组"); sys.exit(1)

# 2) 给每个 SG 加入站规则
vpc = vpc_client.VpcClient(cred, REGION, ClientProfile())
for g in sg:
    pols = []
    for port in PORTS:
        p = vm.SecurityGroupPolicy()
        p.Protocol = "TCP"
        p.Port = port.strip()
        p.CidrBlock = "0.0.0.0/0"
        p.Action = "ACCEPT"
        p.PolicyDescription = f"luban prod direct access {port.strip()}"
        pols.append(p)
    r = vm.CreateSecurityGroupPoliciesRequest()
    r.SecurityGroupId = g
    ps = vm.SecurityGroupPolicySet()
    ps.Ingress = pols
    r.SecurityGroupPolicySet = ps
    try:
        vpc.CreateSecurityGroupPolicies(r)
        print(f"  ✓ {g}: 已放行入站 TCP {','.join(PORTS)} (0.0.0.0/0 ACCEPT)")
    except Exception as e:
        msg = str(e)
        low = msg.lower()
        if any(k in low or k in msg for k in ("already", "duplicate", "exist", "重复", "已存在")):
            print(f"  • {g}: 规则已存在，跳过")
        else:
            print(f"  ✗ {g}: {msg}")
