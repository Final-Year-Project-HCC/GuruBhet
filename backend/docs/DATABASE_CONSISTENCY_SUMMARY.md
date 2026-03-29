# Summary: Database Consistency Problem and Solution

## Executive Summary

**Problem:** If the `room_finished` webhook doesn't arrive, the database becomes inconsistent.

- Session status is set to COMPLETED ✅
- But transaction is never created ❌
- And counters are never updated ❌
- And notifications are never sent ❌

**Solution:** Implement **Receipt Tracking + Cleanup Job** pattern.

- Record that webhook was received (WebhookReceipt model)
- Process webhook with idempotent guards
- Cleanup job retries any failed processing within 1 hour
- Guarantees consistency even if webhooks are lost

---

## The Problem in Detail

### Current Architecture

```
Route Handler                  Webhook Handler
───────────────────────────    ──────────────────────────
1. Set session.status
2. Set actual_end_at
3. db.commit()

4. end_room() ─────────────→   5. room_finished arrives
                               6. IF PROCESSING FAILS:
                                  └─ Exception rolled back
                                  └─ No retry mechanism
                                  └─ Silent failure

Result: Session marked complete, but no payment, no counters
```

### Three Failure Modes

1. **Webhook Lost** - Event never reaches webhook handler
2. **Webhook Processing Fails** - Event arrives but database error occurs
3. **Duplicate Webhooks** - Same event processed twice

| Failure          | Current        | Risk        |
| ---------------- | -------------- | ----------- |
| Webhook lost     | No recovery    | 🔴 Critical |
| Processing fails | No recovery    | 🔴 Critical |
| Duplicate event  | Both processed | 🟠 High     |

---

## The Solution: Receipt + Cleanup Pattern

### How It Works

```
Step 1: Record Receipt (FAST)
├─ Webhook arrives
├─ Record in WebhookReceipt table
├─ Commit immediately (1 record only)
└─ Proves event was received

Step 2: Process Webhook (WITH GUARDS)
├─ Get session from DB
├─ Create transaction (if not exists)
├─ Update counters (idempotent)
├─ Emit notifications
├─ Schedule tasks
├─ Mark receipt.processed = True
└─ Commit

Step 3: Cleanup Job (RECOVERY)
├─ Every 5 minutes
├─ Find unprocessed receipts older than 1 hour
├─ Retry the webhook processing
├─ Either succeeds → marked processed
└─ Or fails → retry again (max 5 attempts)
```

### Key Benefits

✅ **No Lost Webhooks:** Event is recorded even if delivery fails later
✅ **Self-Healing:** Cleanup job recovers from failures automatically
✅ **No Duplicates:** Unique constraint on (room_name, event_type) prevents re-processing
✅ **Auditable:** Full history of webhook receipts and processing
✅ **Observable:** Can track unprocessed webhooks in real-time

---

## Implementation Overview

### 4 Components to Add

#### 1. WebhookReceipt Model

```python
class WebhookReceipt(Base):
    id: UUID
    room_name: str
    event_type: str
    received_at: DateTime
    processed: bool  # False = needs retry, True = complete
    processed_at: DateTime | None
    error_message: str | None
    error_count: int  # Track retry attempts
```

#### 2. Updated Webhook Handler

```python
# Step 1: Record receipt (fast)
receipt = WebhookReceipt(room_name="...", event_type="room_finished")
db.add(receipt)
await db.commit()  # Minimal transaction

# Step 2: Process with guards (with idempotent checks)
if not existing_transaction:
    create_transaction()

booking.completed_sessions += 1  # Idempotent
emit_notifications()
schedule_tasks()

receipt.processed = True
await db.commit()
```

#### 3. Cleanup Job (Celery)

```python
@celery_app.task
async def cleanup_unprocessed_webhooks():
    # Find receipts not processed in 1 hour
    unprocessed = db.query(WebhookReceipt).filter(
        processed=False,
        received_at < now - 1hour,
        error_count < 5
    )

    for receipt in unprocessed:
        retry_webhook_processing(receipt)
        # Succeeds or increments error_count
```

#### 4. Scheduled Execution

```python
# Celery Beat: Run cleanup every 5 minutes
beat_schedule = {
    'cleanup-webhooks': {
        'task': '...cleanup_unprocessed_webhooks',
        'schedule': timedelta(minutes=5),
    }
}
```

---

## Risk Reduction

### Before (VULNERABLE)

```
Loss Risk       ⭐⭐⭐ (High)
Failure Risk    ⭐⭐⭐ (High)
Duplicate Risk  ⭐⭐  (Medium)
─────────────────────────────
Overall: 🔴 CRITICAL
```

### After (SAFE)

```
Loss Risk       ⭐   (Low) - Recovered in <1 hour
Failure Risk    ⭐⭐  (Low) - Recovered in <1 hour
Duplicate Risk  ⭐   (Low) - Prevented by unique constraint
─────────────────────────────
Overall: 🟢 ACCEPTABLE
```

---

## Timeline Impact

### Webhook Failure Scenario

**Before:**

```
T+0s    Session marked COMPLETED
        Client notified

T+100ms Webhook arrives
        Processing fails

T+101ms Webhook silently fails
        No recovery

FOREVER: Session never gets paid 💸
         Counters never updated 📊
         Client never notified 🔔
```

**After:**

```
T+0s    Session marked COMPLETED
        Client notified

T+100ms Webhook arrives
        Receipt recorded ✅
        Processing fails

T+101ms Error logged, receipt NOT marked processed

T+5min  Cleanup job runs
        Finds unprocessed receipt
        Retries processing ✅

NOW: Session gets paid, counters updated, client notified
```

---

## Data Consistency Guarantees

With Receipt + Cleanup pattern:

| Guarantee             | Mechanism                          | Recovery Time |
| --------------------- | ---------------------------------- | ------------- |
| No lost transactions  | Receipt proves event received      | < 1 hour      |
| No duplicate payments | Unique constraint on (room, event) | Immediate     |
| No missing counters   | Cleanup job retries                | < 1 hour      |
| No lost notifications | Tasks scheduled by cleanup         | < 1 hour      |
| Full audit trail      | WebhookReceipt history             | Forever       |

---

## Implementation Effort

| Phase | Work                                         | Time    | Priority  |
| ----- | -------------------------------------------- | ------- | --------- |
| 1     | Add WebhookReceipt model + migration         | 1 hour  | 🔴 High   |
| 2     | Update webhook handler with receipt + guards | 2 hours | 🔴 High   |
| 3     | Implement cleanup job + scheduling           | 1 hour  | 🔴 High   |
| 4     | Add tests for recovery scenarios             | 1 hour  | 🟡 Medium |
| 5     | Add monitoring and alerts                    | 1 hour  | 🟡 Medium |
| 6     | Documentation and runbooks                   | 1 hour  | 🟢 Low    |

**Total: ~7 hours of development work**

---

## Testing Strategy

### Unit Tests

- Receipt is recorded correctly
- Receipt uniqueness constraint works
- Cleanup job finds unprocessed receipts
- Idempotent processing (duplicate calls = same result)

### Integration Tests

- Webhook loses event: cleanup recovers it
- Webhook fails: retry succeeds
- Duplicate webhook: no duplicate records
- Concurrent webhooks: all processed correctly

### Load Tests

- Handle 1000+ concurrent webhooks
- Cleanup job performance with 1000+ unprocessed receipts

---

## Monitoring & Alerting

After deployment, monitor:

```
1. Unprocessed Webhooks
   └─ Query: SELECT COUNT(*) FROM webhook_receipts WHERE processed = False
   └─ Alert if > 10 (should be near 0)

2. Webhook Age
   └─ Query: SELECT MAX(received_at - processed_at) ...
   └─ Alert if > 5 minutes (should be < 1 minute normally)

3. Retry Exhaustion
   └─ Query: SELECT * FROM webhook_receipts WHERE error_count >= 5
   └─ Alert: Page oncall immediately

4. Cleanup Job Execution
   └─ Track: Does cleanup job run every 5 minutes?
   └─ Alert if missing 2 consecutive runs

5. Error Rate
   └─ Track: error_count distribution in WebhookReceipt
   └─ Alert if error_count > 2 for any receipt
```

---

## Rollout Plan

### Phase 1: Preparation (Day 1)

- Create WebhookReceipt model
- Write and test migration
- Write cleanup job code
- Write tests

### Phase 2: Staging (Day 2)

- Deploy to staging environment
- Run load tests
- Verify cleanup job works
- Monitor for 4 hours

### Phase 3: Production (Day 3)

- Deploy WebhookReceipt migration
- Update webhook handler with receipt recording
- Deploy cleanup job
- Enable monitoring

### Phase 4: Monitoring (Day 3-7)

- Watch for unprocessed receipts
- Monitor cleanup job runs
- Verify recovery is working
- Alert if issues found

---

## FAQ

**Q: What if the cleanup job fails?**
A: The cleanup job has retries. If it crashes, next run (5 min later) will pick up where it left off.

**Q: What if a webhook is received but cleanup job runs before processing?**
A: The receipt won't be marked processed, so cleanup job will process it. No problem.

**Q: What if we process the same webhook twice?**
A: Unique constraint on (room_name, event_type) prevents duplicate INSERT. Second attempt skips to checking if already processed.

**Q: Do we need to change the route handlers?**
A: No. They stay the same. Only the webhook handler changes.

**Q: Can we remove this after some time?**
A: Eventually yes, but keep it for at least 6 months. It's good defensive programming.

---

## Success Criteria

✅ No unprocessed webhooks accumulating
✅ Cleanup job successfully retrying failed webhooks
✅ No missing transactions for completed sessions
✅ No duplicate transactions
✅ All sessions showing correct counters
✅ No errors in webhook processing logs

---

## Documentation References

1. **DATABASE_CONSISTENCY_WEBHOOK.md** - Problem analysis and approaches
2. **DATABASE_CONSISTENCY_VISUAL.md** - Diagrams and comparisons
3. **WEBHOOK_CONSISTENCY_IMPLEMENTATION.md** - Step-by-step implementation
4. **SESSION_COMPLETION_COMPLETE_IMPLEMENTATION.md** - Full context

---

## Next Steps

1. Review this analysis with the team
2. Decide: Implement now or defer?
3. If implementing: Start with Phase 1 (Preparation)
4. If deferring: Document the risk and contingency plans
5. Either way: Add test for webhook failure scenario NOW

This is a critical reliability improvement that should be done before production launch.
