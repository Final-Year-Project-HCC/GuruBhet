# Session Completion Flow - Migration & Deployment Guide

## Database Schema

### No Schema Changes Required

The session completion flow does not require any new database columns or tables. It leverages existing fields:

**Booking Table** (used):

- `session_duration_minutes` - Duration of each session
- `completed_sessions` - Counter that gets incremented
- `status` - Already tracks COMPLETED status
- `rate_per_session` - Used for payment calculation

**Session Table** (used):

- `status` - Tracks IN_PROGRESS → COMPLETED transition
- `actual_start_at` - Used to calculate elapsed time
- `actual_end_at` - Set when session completes
- `livekit_room_name` - Used to tear down room

**Transactions Table** (used):

- Existing table, SESSION_RELEASE entries created automatically

### Optional: Add duration_seconds Field

If you want to store the actual duration for historical tracking:

```sql
ALTER TABLE sessions ADD COLUMN duration_seconds INTEGER NULL;
```

However, this is **not required** as duration can always be calculated from `actual_start_at` and `actual_end_at`.

---

## Redis Schema

### Premature Session Completion Request

**Key Format**: `premature_session_completion:{session_id}`

**Type**: String (JSON)

**TTL**: 60 seconds (auto-expiring)

**Value Structure**:

```json
{
  "session_id": "uuid-string",
  "requested_at": "ISO-8601 timestamp"
}
```

**Example**:

```
Key: premature_session_completion:550e8400-e29b-41d4-a716-446655440000
Value: {"session_id": "550e8400-e29b-41d4-a716-446655440000", "requested_at": "2025-03-29T10:30:45.123456+00:00"}
TTL: 60
```

---

## Configuration Requirements

### .env File

Add the following if not already present:

```env
# LiveKit room leniency (in minutes) per 15-minute session block
# Example: 2 = 2 minutes of leniency per 15-minute session
# For a 60-minute session (4 blocks): 4 × 2 = 8 minutes total leniency
LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN=2
```

### Example Leniency Configurations

| Duration | Blocks | Per-Block | Total Leniency | Full Duration with Leniency |
| -------- | ------ | --------- | -------------- | --------------------------- |
| 15 min   | 1      | 2 min     | 2 min          | 17 min                      |
| 30 min   | 2      | 2 min     | 4 min          | 34 min                      |
| 45 min   | 3      | 2 min     | 6 min          | 51 min                      |
| 60 min   | 4      | 2 min     | 8 min          | 68 min                      |

---

## Deployment Checklist

- [ ] Add `LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN` to `.env` (or use default)
- [ ] Ensure Redis is running and configured correctly
- [ ] Deploy backend code with the new endpoints
- [ ] Verify Socket.IO server is running
- [ ] Test the three new endpoints in a staging environment
- [ ] Update API documentation/OpenAPI schema
- [ ] Notify frontend teams about the new socket events
- [ ] Monitor first live usage for any issues

---

## Frontend Integration Required

The frontend needs to handle these new socket events and provide UI for student approval:

### 1. Listen for Premature Completion Request

When student receives `premature-session-completion-requested`:

```javascript
socket.on("premature-session-completion-requested", (data) => {
  console.log(
    `Teacher requested early completion. ${data.remaining_duration_seconds} seconds remaining.`,
  );
  // Show modal with Accept/Reject buttons
});
```

### 2. Accept Request

```javascript
async function acceptCompletion(sessionId) {
  const response = await fetch(
    `/api/v1/sessions/${sessionId}/accept-session-completion`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (response.ok) {
    // Session completed
  }
}
```

### 3. Reject Request

```javascript
async function rejectCompletion(sessionId) {
  const response = await fetch(
    `/api/v1/sessions/${sessionId}/reject-session-completion`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (response.ok) {
    // Request rejected, session continues
  }
}
```

### 4. Listen for Rejection (Teacher side)

```javascript
socket.on("premature-session-completion-rejected", (data) => {
  console.log("Student rejected early completion. Session continues.");
  // Show notification to teacher
});
```

### 5. Listen for Session End

```javascript
socket.on("session-ended", (data) => {
  console.log(`Session ended. Duration: ${data.duration_seconds} seconds`);
  // Redirect to post-session screen
});
```

---

## Rollback Plan

If issues are discovered:

1. **Soft Rollback**: Keep endpoints but make teacher-facing UI unavailable
2. **Hard Rollback**: Revert the code changes
3. **No Data Cleanup**: Redis keys auto-expire, no DB changes to reverse

---

## Monitoring & Logging

### Key Metrics to Monitor

1. **Request Success Rate**: Track 200/409/400/403 responses
2. **Redis Key Lifetime**: Monitor if keys are expiring normally
3. **Socket Event Delivery**: Track if events reach clients
4. **Session Completion Rate**: Monitor if more sessions complete early
5. **Payment Processing**: Ensure SESSION_RELEASE transactions are created

### Logs to Watch For

```
ERROR: Request session completion - teacher not authorized
ERROR: Redis key already exists - request already pending
ERROR: No pending request found - accept/reject without request
ERROR: Socket.IO unavailable - events may not be delivered
```

### Celery Task Monitoring

Monitor these Celery tasks:

- `process_session_billing` - Should complete successfully
- `send_session_complete_notification` - Should reach all recipients

---

## Performance Considerations

### Redis Performance

- Key lookup: O(1) - negligible impact
- Auto-expiration: Handled by Redis, no additional load

### Database Performance

- Session completion involves single UPDATE + counter increments
- No new indexes required
- No N+1 query issues

### Socket.IO Performance

- Events broadcast to room: Scales with participant count (always 2)
- No subscription overhead beyond existing

---

## Security Considerations

### Authorization

- ✅ Teacher-only: `request-session-completion`
- ✅ Student-only: `accept-session-completion`, `reject-session-completion`
- ✅ Session ownership verified via booking relationship

### Data Validation

- ✅ Session ID and user ID validated
- ✅ Session status checked before operations
- ✅ Redis key validation prevents replay attacks

### Redis Key Expiration

- ✅ 60-second TTL prevents indefinite pending state
- ✅ Protects against stale requests

---

## Future Enhancements

Potential improvements for later iterations:

1. **Analytics**: Track why teachers request early completion (satisfaction metric)
2. **Audit Trail**: Log all completion requests/rejections
3. **Configurable Leniency**: Per-teacher or per-subject leniency settings
4. **Extended Timeout**: Allow extension beyond scheduled time (reverse flow)
5. **Bulk Completion**: Complete all sessions in a booking together
6. **Automated Reminders**: Notify if approval pending for too long
7. **Appeal Mechanism**: Teacher can appeal student rejection after timeout
