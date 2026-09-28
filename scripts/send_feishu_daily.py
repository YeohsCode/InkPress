#!/usr/bin/env python3
"""把 data/report.json 对应的 9 张图 + 全文文案逐条发到飞书日报群。
发送通道 = `hermes send --to feishu:<chat_id>`；渠道来自环境变量 FEISHU_DAILY_CHAT，
未设置时回落到日报群 oc_4f6f0ec40c6b9fb609ed619bfa60f659。
每条发送后校验输出含 sent，失败重试 1 次，退出码非 0 表示有未送达项。"""
import subprocess, json, time, os, sys

D = "/Users/andrewyeoh/Werk/projects/content-pipeline"
CHAT = os.environ.get("FEISHU_DAILY_CHAT", "feishu:oc_4f6f0ec40c6b9fb609ed619bfa60f659")
IMGS = ["cover.png","info_02.png","info_03.png","info_04.png","info_05.png",
        "info_06.png","info_07.png","info_08.png","info_09.png"]

rep = json.load(open(f"{D}/data/report.json"))
title = rep["cover"]["title_lines"][0]

def send(args, label, retries=1):
    out = ""
    for _ in range(retries + 1):
        r = subprocess.run(["hermes", "send"] + args, capture_output=True, text=True, timeout=120)
        out = r.stdout + r.stderr
        if "sent" in out.lower():
            print(label, "sent")
            return True
        time.sleep(3)
    print(label, "FAIL:", out.strip()[:200])
    return False

fails = 0
for i, fn in enumerate(IMGS, 1):
    p = f"{D}/data/images/html/{fn}"
    if not send(["--to", CHAT, "-s", f"{i}/6 {title}", f"MEDIA:{p}"], f"img{i}"):
        fails += 1

lines = [f"AI 圈每天深读 · 2026-09-29｜{rep['cover']['title_lines'][0]}，{rep['cover']['title_lines'][1]}", ""]
for c in rep["cards"]:
    lines.append("◆ " + c["title"])
    lines.extend(c["points"])
    lines.append("")
lines.append("参考资料：")
for r in rep["references"]:
    lines.append(r)
if not send(["--to", CHAT, "-s", "6/6 全文文案", "\n".join(lines)], "text"):
    fails += 1

sys.exit(1 if fails else 0)
