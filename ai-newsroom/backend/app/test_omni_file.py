import asyncio
import os
import httpx
import json

async def test():
    api_key = os.environ.get("QWEN_API_KEY")
    url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    file_id = "file-fe-0533d1ad34c044e98c1f2191" # the one from logs
    
    # Try 1: file_id directly
    payload1 = {
        "model": "qwen-omni-turbo",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": f"file://{file_id}",
                            "format": "mp3"
                        }
                    },
                    {
                        "type": "text", 
                        "text": "测试"
                    }
                ]
            }
        ],
        "temperature": 0.1
    }
    
    # Try 2: URL format with file://
    payload2 = {
        "model": "qwen-omni-turbo",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": f"https://dashscope.aliyuncs.com/api/v1/files/{file_id}",
                            "format": "mp3"
                        }
                    },
                    {
                        "type": "text", 
                        "text": "测试"
                    }
                ]
            }
        ],
        "temperature": 0.1
    }
    
    async with httpx.AsyncClient() as client:
        r1 = await client.post(url, headers=headers, json=payload1)
        print("Try 1 (file://file_id):", r1.status_code, r1.json())
        
        r2 = await client.post(url, headers=headers, json=payload2)
        print("Try 2 (url):", r2.status_code, r2.json())

asyncio.run(test())
