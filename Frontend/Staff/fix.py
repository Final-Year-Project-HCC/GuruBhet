import re
with open("../../backend/app/core/dependencies.py", "r") as f: text=f.read()
text=text.replace("from fastapi import Depends, HTTPException, status, Header", "from fastapi import Depends, status, Header")
text=text.replace("from app.core.enums import UserRole", "from app.core.enums import UserRole\nfrom app.core.exceptions import MissingTokenError, InvalidTokenError, UserNotFoundError, PermissionDeniedError")
text=re.sub(r"raise HTTPException\(status_code=status\.HTTP_401_UNAUTHORIZED, detail=\"Access token missing\"\)", "raise MissingTokenError(detail=\"Access token missing\")", text)
text=re.sub(r"raise HTTPException\(status_code=status\.HTTP_401_UNAUTHORIZED, detail=\"Invalid access token\"\)", "raise InvalidTokenError(detail=\"Invalid access token\")", text)
