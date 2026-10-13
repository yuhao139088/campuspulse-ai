from pathlib import Path
import json
import requests

base = "https://cam.yuhaocloud.cn"
account = Path("/etc/campuspulse/initial-account.txt").read_text().splitlines()
client = requests.Session()
csrf = client.get(base + "/api/auth/csrf").json()["csrfToken"]
client.post(base + "/api/auth/callback/credentials", data={"csrfToken": csrf, "email": account[0].split(": ",1)[1], "password": account[1].split(": ",1)[1], "callbackUrl": base, "json": "true"}, timeout=20).raise_for_status()
spaces = client.get(base + "/api/spaces").json()["spaces"]
team = next(item for item in spaces if item["slug"] == "campuspulse-team")
client.patch(base+"/api/spaces",json={"id":team["id"]}).raise_for_status()
with Path("/root/campuspulse-ocr-verification.png").open("rb") as image:
    result = client.post(base+"/api/import",files={"file":("上线验收图片.png",image,"image/png")},data={"locale":"en"},timeout=180)
if result.status_code != 201:
    print("OCR import failed HTTP",result.status_code)
    print(result.text[:300])
    raise SystemExit(1)
dataset = result.json()["dataset"]
document = dataset["evidence"][0]["content"]
ocr = document.get("ocr")
if not ocr or "56" not in ocr.get("text","") or "43" not in ocr.get("text",""):
    raise RuntimeError("OCR did not preserve the known source values")
Path("/etc/campuspulse/ocr-smoke.json").write_text(json.dumps({"datasetId":dataset["id"],"method":ocr["method"],"model":ocr["model"],"fields":document["columns"],"passed":True},ensure_ascii=False,indent=2))
print("PASS original image persisted; real OCR recognized 56 registrations and 43 check-ins; method=" + ocr["method"] + "; model=" + ocr["model"],flush=True)
