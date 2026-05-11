import asyncio
import os
from openai import AsyncOpenAI

async def main():
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("NO API KEY")
        return

    client = AsyncOpenAI(api_key=api_key, base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")

    # Create a tiny dummy wav file
    import wave
    import base64
    with wave.open("test.wav", "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(8000)
        f.writeframes(b'\x00' * 8000) # 1 sec silence
    
    with open("test.wav", "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    try:
        response = await client.chat.completions.create(
            model="qwen-audio-turbo-latest",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": b64,
                                "format": "wav"
                            }
                        },
                        {"type": "text", "text": "描述音频"}
                    ]
                }
            ]
        )
        print("Success (input_audio):", response.choices[0].message.content)
    except Exception as e:
        print("Failed input_audio:", e)

    try:
        response = await client.chat.completions.create(
            model="qwen-audio-turbo-latest",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "audio_url",
                            "audio_url": {
                                "url": f"data:audio/wav;base64,{b64}"
                            }
                        },
                        {"type": "text", "text": "描述音频"}
                    ]
                }
            ]
        )
        print("Success (audio_url base64):", response.choices[0].message.content)
    except Exception as e:
        print("Failed audio_url base64:", e)
        
    try:
        file_obj = await client.files.create(file=open("test.wav", "rb"), purpose="file-extract")
        response = await client.chat.completions.create(
            model="qwen-audio-turbo-latest",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "audio",
                            "audio": file_obj.id
                        },
                        {"type": "text", "text": "描述音频"}
                    ]
                }
            ]
        )
        print("Success (fileid):", response.choices[0].message.content)
    except Exception as e:
        print("Failed fileid:", e)

asyncio.run(main())
