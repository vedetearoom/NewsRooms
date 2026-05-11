import asyncio
import os
from openai import AsyncOpenAI
import logging

logging.basicConfig(level=logging.INFO)

async def test():
    api_key = os.environ.get("QWEN_API_KEY")
    if not api_key:
        raise RuntimeError("Set QWEN_API_KEY before running this script.")

    client = AsyncOpenAI(
        api_key=api_key,
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
                            "type": "audio",
                            "audio": file_id
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
        print("Success with 'audio':", response)
    except Exception as e:
        print("Failed with 'audio':", e)

    try:
        response = await client.chat.completions.create(
            model="qwen-audio-turbo-latest",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "audio_url",
                            "audio_url": {"url": "https://dashscope.oss-cn-beijing.aliyuncs.com/audios/welcome.mp3"}
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
        print("Success with 'audio_url' url:", response)
    except Exception as e:
        print("Failed with 'audio_url' url:", e)

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
        print("Success with 'audio_url' file id:", response)
    except Exception as e:
        print("Failed with 'audio_url' file id:", e)

asyncio.run(test())
