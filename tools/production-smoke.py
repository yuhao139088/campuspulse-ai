import json
import secrets
from pathlib import Path
import requests

base = "https://cam.yuhaocloud.cn"
lines = Path("/etc/campuspulse/initial-account.txt").read_text().splitlines()
email = lines[0].split(": ", 1)[1]
password = lines[1].split(": ", 1)[1]
results = []
def check(name, value):
    if not value:
        raise RuntimeError("Check failed: " + name)
    results.append(name)
    print("PASS " + name, flush=True)
def login(email_value, password_value):
    client = requests.Session()
    csrf = client.get(base + "/api/auth/csrf", timeout=20).json()["csrfToken"]
    response = client.post(base + "/api/auth/callback/credentials", data={"csrfToken": csrf, "email": email_value, "password": password_value, "callbackUrl": base + "/dashboard", "json": "true"}, timeout=30)
    response.raise_for_status()
    session = client.get(base + "/api/auth/session", timeout=20).json()
    if not session.get("user", {}).get("id"):
        raise RuntimeError("Login failed")
    return client, session["user"]["id"]

check("HTTPS and database/storage health", requests.get(base + "/api/health", timeout=20).json().get("ok"))
check("Anonymous AI API denied", requests.post(base + "/api/ai/analyze", json={"prompt":"hello"}, timeout=20).status_code == 401)
client, user_id = login(email, password)
check("Real account login (not demo)", user_id != "demo-user")
spaces = client.get(base + "/api/spaces", timeout=20).json()
team = next(item for item in spaces["spaces"] if item["slug"] == "campuspulse-team")
client.patch(base + "/api/spaces", json={"id": team["id"]}, timeout=20).raise_for_status()
csv_data = b"activity,month,registered,checkedIn,satisfaction,budget\nWorkshop,2026-08,50,40,4.5,1200\nWorkshop,2026-09,60,48,4.6,1400\nWelcome,2026-09,90,75,4.8,2200\nWelcome,2026-10,80,64,4.2,2100\nOpenDay,2026-10,100,35,3.1,4000\nOpenDay,2026-11,70,25,3.0,3500\n"
response = client.post(base + "/api/import", files={"file": ("上线验收数据.csv", csv_data, "text/csv")}, data={"locale":"en"}, timeout=160)
check("CSV import into database", response.status_code == 201)
dataset = response.json()["dataset"]
dataset_id = dataset["id"]
check("Correct full row persistence", dataset["rowCount"] == 6 and dataset["columnCount"] == 6)
download = client.get(base + "/api/datasets/" + dataset_id + "/download", timeout=30)
check("Original file persisted in private S3", download.content == csv_data)
analysis = client.post(base + "/api/ai/analyze", json={"datasetId":dataset_id,"locale":"en","prompt":"What are the total registrations and total checkedIn across the entire dataset? Use aggregate_metrics separately for both fields, report exact sums and one budget efficiency concern. Do not refer to any other dataset."}, timeout=600)
check("Live AI request succeeds", analysis.status_code == 200)
analysis_data = analysis.json()
check("AI reads selected dataset", analysis_data.get("datasetId") == dataset_id and analysis_data.get("mode") == "live")
check("Agent executed aggregate tool", "aggregate_metrics" in analysis_data.get("tools", []))
Path("/etc/campuspulse/smoke-analysis.json").write_text(json.dumps(analysis_data, ensure_ascii=False, indent=2))
config={"components":["smoke-chart"],"chartType":"smoke-chart","datasetId":dataset_id,"charts":[{"id":"smoke-chart","title":"验收：签到人数","type":"bar","category":"activity","metric":"checkedIn","aggregation":"sum"}]}
check("Canvas saved to database", client.put(base+"/api/canvas",json=config,timeout=20).status_code==200)
check("Canvas survives independent fetch", client.get(base+"/api/canvas",timeout=20).json()["config"]["charts"][0]["metric"]=="checkedIn")
report_response=client.post(base+"/api/reports",json={"title":"上线验收数据分析报告","prompt":"Provide a concise review of registrations, check-ins and budget efficiency with source evidence.","datasetId":dataset_id,"locale":"en"},timeout=600)
check("AI report generation and persistence", report_response.status_code==201)
report=report_response.json()["report"]
check("Report markdown is not empty", len(report["content"]["markdown"])>100)
docx=client.post(base+"/api/reports/export",json={"title":report["title"],"markdown":report["content"]["markdown"],"format":"docx"},timeout=30)
check("DOCX export is a real Word archive", docx.status_code==200 and docx.content[:2]==b"PK")
saved=client.put(base+"/api/reports/"+report["id"],json={"title":report["title"],"markdown":report["content"]["markdown"]+"\n\nProduction verification."},timeout=30)
check("Report edit version saved",saved.status_code==200)
check("Report version history persisted",len(client.get(base+"/api/reports/"+report["id"],timeout=20).json()["versions"])==2)
test_email="verification-"+secrets.token_hex(4)+"@campuspulse.local"
test_password=secrets.token_urlsafe(22)
registered=requests.post(base+"/api/auth/register",json={"name":"上线验收只读用户","email":test_email,"password":test_password},timeout=30)
check("Real registration",registered.status_code==201)
viewer,viewer_id=login(test_email,test_password)
check("Cross-user dataset denied",viewer.get(base+"/api/datasets/"+dataset_id,timeout=20).status_code==404)
check("Cross-user admin denied",viewer.get(base+"/api/admin",timeout=20).json().get("datasets")==[])
invite=client.post(base+"/api/admin",json={"name":"上线验收只读用户","email":test_email,"role":"VIEWER"},timeout=20)
check("Invitation persisted",invite.status_code==200)
check("Invitation accepted by matching account",viewer.post(base+"/api/invitations",json={"token":invite.json()["invitation"]["token"]},timeout=20).status_code==200)
check("Viewer can read shared dataset",viewer.get(base+"/api/datasets/"+dataset_id,timeout=20).status_code==200)
check("Viewer cannot modify canvas",viewer.put(base+"/api/canvas",json=config,timeout=20).status_code==403)
check("Viewer cannot administer shared workspace",viewer.get(base+"/api/admin",timeout=20).status_code==403)
admin=client.get(base+"/api/admin",timeout=20).json()
membership=next(item for item in admin["members"] if item["user"]["id"]==viewer_id)
client.patch(base+"/api/admin",json={"memberId":membership["id"],"remove":True},timeout=20).raise_for_status()
check("Revocation takes effect immediately",viewer.get(base+"/api/datasets/"+dataset_id,timeout=20).status_code==403)
preferences={"locale":"zh","theme":"dark","motion":True,"notifications":True}
check("Preferences persisted",client.put(base+"/api/preferences",json=preferences,timeout=20).status_code==200)
check("Operation audit contains real events",len(admin["logs"])>=6)
Path("/etc/campuspulse/smoke-results.json").write_text(json.dumps({"checks":results,"datasetId":dataset_id,"reportId":report["id"],"testUserId":viewer_id},ensure_ascii=False,indent=2))
print("All production checks passed; results stored privately",flush=True)
