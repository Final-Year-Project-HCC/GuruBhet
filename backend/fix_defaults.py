import os

endpoints_dir = 'app/api/v1/endpoints/'
files = [f for f in os.listdir(endpoints_dir) if f.endswith('.py')]

for file in files:
    path_file = os.path.join(endpoints_dir, file)
    with open(path_file, 'r') as f:
        content = f.read()

    # Replace Path(default=...) with Query(default=...)
    new_content = content.replace('Path(default=', 'Query(default=')
    new_content = new_content.replace('Path(..., alias=', 'Path(..., alias=') # no-op
    # For any route definition, if we have Annotated[T, Path(...)], it acts as no default,
    # which is perfectly fine for FastAPI path parameters.

    if new_content != content:
        with open(path_file, 'w') as f:
            f.write(new_content)

print("Fixed defaults")
