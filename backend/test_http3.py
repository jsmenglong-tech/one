# -*- coding: utf-8 -*-
import httpx

# 先测试普通 ASCII 参数
r1 = httpx.get("http://localhost:8000/knowledge/search", params={"q": "abc"})
print("ASCII test status:", r1.status_code)
print("ASCII response:", r1.text[:200])

# 再测试中文
r2 = httpx.get("http://localhost:8000/knowledge/search", params={"q": "\u65bd\u5de5"})
print("Chinese test status:", r2.status_code)
print("Chinese response:", r2.text[:200])
