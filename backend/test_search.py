import sqlite3
conn = sqlite3.connect('data/jzs.db')
rows = conn.execute("SELECT title FROM knowledge_points WHERE title LIKE '%施工%' LIMIT 5").fetchall()
print(f"搜索'施工'结果数: {len(rows)}")
for r in rows:
    print(" -", r[0])

rows2 = conn.execute("SELECT title FROM knowledge_points WHERE title LIKE '%成本%' LIMIT 5").fetchall()
print(f"\n搜索'成本'结果数: {len(rows2)}")
for r in rows2:
    print(" -", r[0])
conn.close()
