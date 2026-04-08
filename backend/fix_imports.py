import os
import re

endpoints_dir = 'app/api/v1/endpoints/'
files = [f for f in os.listdir(endpoints_dir) if f.endswith('.py')]

for file in files:
    path_file = os.path.join(endpoints_dir, file)
    with open(path_file, 'r') as f:
        content = f.read()

    # If file starts with 'from typing import Annotated\n"""'
    if content.startswith('from typing import Annotated\n'):
        # Remove from top
        content = content.replace('from typing import Annotated\n', '', 1)
        # Add it back after docstring or to normal imports
        if 'from fastapi import' in content:
            content = content.replace('from fastapi import', 'from typing import Annotated\nfrom fastapi import', 1)
        else:
            content = 'from typing import Annotated\n' + content

        with open(path_file, 'w') as f:
            f.write(content)

print("Imports fixed")
