import asyncio
import os
import aiohttp
import json

async def test():
    api_key = os.environ.get("QWEN_API_KEY")
    if not api_key:
        print("Missing key")
        return
    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "qwen-audio-turbo-latest",
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"audio": "file-fe-2159ba909d5d431e9929bcf9"},
                        {"text": "测试"}
                    ]
                }
            ]
        },
        "parameters": {
            "temperature": 0.1
        }
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload) as response:
            result = await response.json()
            print("Status:", response.status)
            print("Body:", json.dumps(result, ensure_ascii=False, indent=2))

asyncio.run(test())
