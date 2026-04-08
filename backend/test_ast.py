from fastapi import Path
def foo(*, booking_id: str = Path(...), current_user: str):
    pass
print("Syntax OK")
