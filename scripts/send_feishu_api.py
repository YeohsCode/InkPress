#!/usr/bin/env python3
"""飞书 Open API 直发日报：先取 tenant_access_token（读 ~/.hermes/.env 的
FEISHU_APP_ID/FEISHU_APP_SECRET），上传 9 张图逐条发 image 消息，再发全文文案。
发送目标用环境变量 FEISHU_DAILY_CHAT 覆盖，默认日报群 open_chat_id。
输出逐条回执，任何一条失败退出码非 0。"""
import json, os, sys, urllib.request, urllib.parse

D = "/Users/andrewyeoh/Werk/projects/content-pipeline"
CHAT = os.environ.get("FEISHU_DAILY_CHAT", "oc_4f6f0ec40c6b9fb609ed619bfa60f659")
IMGS = ["cover.png","info_02.png","info_03.png","info_04.png","info_05.png",
        "info_06.png","info_07.png","info_08.png","info_09.png"]

env = {}
for line in open(os.path.expanduser("~/.hermes/.env")):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"')

def post(url, data=None, headers=None, files=None):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            body = json.loads(body)
        except Exception:
            pass
        return {"code": e.code, "msg": str(body)[:500]}

# 1) token
r = post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
         json.dumps({"app_id": env["FEISHU_APP_ID"], "app_secret": env["FEISHU_APP_SECRET"]}).encode(),
         {"Content-Type": "application/json"})
tok = r["tenant_access_token"]
assert r.get("code") == 0, r
H = {"Authorization": "Bearer " + tok}

def send_text(text):
    body = json.dumps({"chat_id": CHAT, "msg_type": "text",
                       "content": json.dumps({"text": text})}).encode()
    r = post("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
             body, {"Content-Type": "application/json", **H})
    return r

def send_image(path):
    # multipart upload
    boundary = "BNDRY7f3k"
    with open(path, "rb") as f:
        img = f.read()
    parts = []
    for name, val in [("image_type", "message")]:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{val}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{os.path.basename(path)}"\r\nContent-Type: image/png\r\n\r\n'.encode() + img + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    r = post("https://open.feishu.cn/open-apis/im/v1/images", body,
             {"Authorization": "Bearer " + tok,
              "Content-Type": f"multipart/form-data; boundary={boundary}"})
    if r.get("code") != 0:
        return r, None
    key = r["data"]["image_key"]
    body = json.dumps({"chat_id": CHAT, "msg_type": "image",
                       "content": json.dumps({"image_key": key})}).encode()
    r2 = post("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
              body, {"Content-Type": "application/json", **H})
    return r2, key

rep = json.load(open(f"{D}/data/report.json"))
title = rep["cover"]["title_lines"][0]
fails = 0
for i, fn in enumerate(IMGS, 1):
    r, key = send_image(f"{D}/data/images/html/{fn}")
    ok = r.get("code") == 0
    print(f"img{i}", "sent" if ok else "FAIL " + json.dumps(r, ensure_ascii=False)[:300])
    fails += 0 if ok else 1

lines = [f"AI 圈每天深读 · 2026-09-29｜{title}，{rep['cover']['title_lines'][1]}", ""]
for c in rep["cards"]:
    lines.append("◆ " + c["title"])
    lines.extend(c["points"])
    lines.append("")
lines.append("参考资料：" + rep["references"][0]["url"])
r = send_text("\n".join(lines))
ok = r.get("code") == 0
print("text", "sent" if ok else "FAIL " + json.dumps(r, ensure_ascii=False)[:300])
fails += 0 if ok else 1
sys.exit(1 if fails else 0)
