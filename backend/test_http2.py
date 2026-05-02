# -*- coding: utf-8 -*-
import httpx

r = httpx.get("http://localhost:8000/knowledge/search", params={"q": "施工"})
print("HTTP status:", r.status_code)
print("Response text:", r.text[:300])
d = r.json()
print("query:", d["query"])
print("count:", len(d["results"]))
for x in d["results"][:5]:
    print("-", x["title"])
