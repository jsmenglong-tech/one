"""测试HTTP请求中文参数"""
import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        r = await client.get("http://localhost:8000/knowledge/search", params={"q": "施工"})
        data = r.json()
        print(f"query: {data['query']}")
        print(f"结果数: {len(data['results'])}")
        for item in data['results'][:3]:
            print(" -", item['title'])

asyncio.run(test())
