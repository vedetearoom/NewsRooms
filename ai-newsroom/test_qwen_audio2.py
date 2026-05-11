import asyncio
import os
import requests
from openai import AsyncOpenAI

async def test():
    client = AsyncOpenAI(
        api_key=os.environ.get("QWEN_API_KEY"), 
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
    file_id = "file-fe-2159ba909d5d431e9929bcf9"

    try:
        response = await client.chat.completions.create(
            model="qwen-audio-turbo-latest",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "audio_url",
                            "audio_url": {"url": file_id}
                        },
                        {
                            "type": "text", 
                            "text": "测试"
                        }
                    ]
                }
            ],
            temperature=0.1,
        )
        print("Success with audio_url file_id")
    except Exception as e:
        print("Failed:", e)

asyncio.run(test())
