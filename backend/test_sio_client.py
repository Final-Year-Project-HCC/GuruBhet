import asyncio
import socketio

sio = socketio.AsyncClient()

@sio.event
async def connect():
    print("Connection established!")

@sio.event
async def connect_error(data):
    print("The connection failed:", data)

@sio.event
async def disconnect():
    print("Disconnected from server")

async def main():
    print("Attempting to connect with invalid token...")
    # Send an invalid token in cookies
    headers = {"Cookie": "access_token=invalid_mock_token_123"}
    try:
        await sio.connect('http://localhost:8000', headers=headers, transports=['websocket'])
        await sio.wait()
    except Exception as e:
        print("Caught exception:", e)

if __name__ == '__main__':
    asyncio.run(main())
