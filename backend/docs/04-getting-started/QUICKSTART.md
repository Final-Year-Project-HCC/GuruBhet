# Real-Time Communication Module - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd backend
pip install python-socketio
```

### Step 2: Add Environment Variables
Add to `.env`:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Get these from: https://cloudinary.com/console

### Step 3: Run Database Migration
```bash
cd backend
alembic upgrade head
```

### Step 4: Restart Backend
```bash
# Kill existing process
# Restart your backend server (uvicorn, docker, etc.)
```

### Step 5: Test Connection (Frontend)
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:8000', {
  query: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect_response', (data) => {
  console.log('Connected!', data);
});
```

---

## ✅ What's Included

- ✅ **Database Models**: Message, Notification, FileMetadata
- ✅ **Backend Service**: save_and_send_message(), send_system_notification()
- ✅ **Socket.IO Server**: Full-featured async server with rooms
- ✅ **Event Handlers**: send_message, typing_status, mark_as_read
- ✅ **Cloudinary Integration**: Signed upload endpoint
- ✅ **Database Migration**: Ready to run
- ✅ **Documentation**: Complete with examples

---

## 🚀 Common Operations

### Send Message from Backend Code
```python
from app.services.communication import CommunicationService
from app.core.socketio import socketio_manager

# In your endpoint:
message = await CommunicationService.save_and_send_message(
    db=db,
    sender_id=sender_id,
    receiver_id=receiver_id,
    content="Hello!",
    socketio_manager=socketio_manager,
)
await db.commit()
```

### Send Notification
```python
await CommunicationService.send_system_notification(
    db=db,
    user_id=user_id,
    notification_type="BOOKING_APPROVED",
    title="Booking Approved",
    message="Your booking is confirmed",
    socketio_manager=socketio_manager,
)
await db.commit()
```

### Frontend: Listen for Messages
```javascript
socket.on('new_message', (message) => {
  console.log('New message:', message);
});

socket.on('new_notification', (notification) => {
  console.log('New notification:', notification.title);
});
```

### Frontend: Send Message
```javascript
socket.emit('send_message', {
  receiver_id: 'uuid-of-recipient',
  content: 'Hello!',
  message_type: 'TEXT'
});
```

---

## 📊 API Endpoints

### Upload Signature
```
GET /api/v1/media/upload-signature
Authorization: Bearer {token}

Response:
{
  "signature": "abc123...",
  "timestamp": 1234567890,
  "cloud_name": "your_cloud",
  "api_key": "your_key"
}
```

---

## 🔌 Socket.IO Events

### Client → Server
- `send_message` - Send a message
- `typing_status` - Send typing indicator
- `mark_as_read` - Mark messages as read
- `join_conversation` - Subscribe to conversation
- `leave_conversation` - Unsubscribe from conversation

### Server → Client
- `connect_response` - Confirmation of connection
- `new_message` - Incoming message
- `message_sent` - Acknowledgment of sent message
- `user_typing` - Typing indicator from other user
- `read_status_updated` - Acknowledgment of read status
- `new_notification` - System notification

---

## 🧪 Testing

### Test with Python socketio-client
```bash
pip install socketio-client-py

socketio-client-py \
  --host localhost \
  --port 8000 \
  --path socket.io \
  --query "token=YOUR_JWT_TOKEN"
```

### Then in the client:
```
emit send_message {"receiver_id": "...", "content": "test"}
on new_message
```

---

## 🔧 Configuration

### CORS Settings
Edit `app/core/socketio.py`:
```python
def create_socketio_server() -> socketio.AsyncServer:
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins=["https://yourdomain.com"],  # Change this
        # ... other settings
    )
```

### Timeouts
- Ping timeout: 60 seconds
- Ping interval: 25 seconds
- Can be adjusted in `create_socketio_server()`

---

## 🐛 Troubleshooting

### Connection fails
1. Check JWT token is valid
2. Verify CORS origins in socketio.py
3. Check backend logs for decode errors

### Messages not received
1. Verify receiver_id is a valid UUID
2. Confirm receiver is connected
3. Check database for message record

### Files not uploading
1. Verify Cloudinary credentials in .env
2. Check file size (max 10MB)
3. Verify file type is allowed

### "Import not resolved" errors
These are editor warnings only. If code doesn't run:
1. Run: `pip install python-socketio`
2. Restart your editor/IDE

---

## 📈 Next Steps

1. ✅ Run migration
2. ✅ Add Cloudinary credentials
3. ✅ Restart backend
4. 📝 Implement frontend Socket.IO client
5. 📝 Add chat UI component
6. 📝 Integrate with booking endpoints
7. 📝 Test end-to-end flow

---

## 📚 Documentation

- **Full Guide**: `COMMUNICATION_MODULE.md`
- **Code Examples**: `CODE_EXAMPLES.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`

---

## 💡 Pro Tips

1. **Always use socketio_manager** when sending notifications from backend code
2. **Group messages by conversation** in frontend UI for better UX
3. **Implement optimistic updates** on frontend for instant feedback
4. **Store messages in browser** cache for offline support
5. **Use notification payloads** to pass actionable data to frontend

---

## 🔐 Security Reminders

- ✅ JWT token is validated on connection
- ✅ Messages only sent to private rooms
- ✅ All inputs are validated with Pydantic
- ✅ File uploads are user-scoped to Cloudinary
- ✅ No unencrypted data in logs

---

## 📞 Support

If something isn't working:

1. Check logs for error messages
2. Verify all environment variables are set
3. Ensure migration has been run
4. Check database for created tables
5. Review examples in `CODE_EXAMPLES.md`

---

**Ready to chat! 🚀**
