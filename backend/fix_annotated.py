import os
import re

endpoints_dir = 'app/api/v1/endpoints/'
files = [f for f in os.listdir(endpoints_dir) if f.endswith('.py')]

for file in files:
    path_file = os.path.join(endpoints_dir, file)
    with open(path_file, 'r') as f:
        content = f.read()

    # Matches: `booking_id: UUID = Path(..., alias="bookingId")`
    #   group 1: var_name  (booking_id)
    #   group 2: Type      (UUID)
    #   group 3: Origin    (Path or Query)
    #   group 4: Args      (alias="bookingId")
    pattern_no_def = r'\b([a-z_][a-z0-9_]*)\s*:\s*([^=,)\n]+)\s*=\s*(Path|Query)\(\.\.\.,\s*(alias="[^"]+")\)'

    def rep_annotated(m):
        var_name = m.group(1)
        typ = m.group(2).strip()
        origin = m.group(3)
        args_with_ellipsis = m.group(4)
        return f'{var_name}: Annotated[{typ}, {origin}(..., {args_with_ellipsis})]'

    new_content = re.sub(pattern_no_def, rep_annotated, content)

    if new_content != content:
        if 'Annotated' not in new_content[:new_content.find('Annotated')]:
            if 'from typing import ' in new_content:
                new_content = re.sub(r'from typing import ', r'from typing import Annotated, ', new_content, count=1)
            else:
                new_content = 'from typing import Annotated\n' + new_content

        with open(path_file, 'w') as f:
            f.write(new_content)

print("Done")
