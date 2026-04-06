import sys
from fastapi import Request
from app.api.v1.endpoints.auth import validate_subdomain_matches_role
from app.core.enums import UserRole

# Simulate a request coming from Swagger UI (api.gurubhet.tech)
scope = {
    "type": "http",
    "headers": [
        (b"host", b"api.gurubhet.tech"),
        (b"origin", b"https://api.gurubhet.tech")
    ]
}
req = Request(scope)

try:
    # If this doesn't raise an exception, the bypass is working!
    validate_subdomain_matches_role(req, UserRole.STAFF)
    print("✅ SUCCESS: Staff user successfully bypassed auth from Swagger UI (api.gurubhet.tech) with an Origin header!")
except Exception as e:
    print(f"❌ FAILED: {e}")

