import asyncio
from typing import Coroutine, Any, TypeVar

T = TypeVar("T")

_loop: asyncio.AbstractEventLoop | None = None

def get_process_loop() -> asyncio.AbstractEventLoop:
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_loop)
    return _loop

def run_async(coro: Coroutine[Any, Any, T]) -> T:
    """Run an async coroutine on the process-level event loop."""
    loop = get_process_loop()
    return loop.run_until_complete(coro)
