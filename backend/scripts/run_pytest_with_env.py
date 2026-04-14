#!/usr/bin/env python3
import os
from pathlib import Path
import shlex
import subprocess

p = Path(__file__).parent.parent / 'backend' / '.env'
if p.exists():
    for raw in p.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k = k.strip()
        v = v.strip()
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1]
        os.environ.setdefault(k, v)

# Run pytest via subprocess so it picks up the environment we set above
rc = subprocess.call(['pytest', '-q'])
raise SystemExit(rc)
