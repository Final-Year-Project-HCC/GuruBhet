#!/usr/bin/env python3
"""
Script to migrate all endpoints from HTTPException to custom exceptions.

This script automatically replaces HTTPException calls with the appropriate
custom exception classes from app.core.exceptions module.

Usage:
    python MIGRATE_ERROR_HANDLING.py

It will:
1. Update all import statements to remove HTTPException and add custom exceptions
2. Replace HTTPException calls with domain-specific exception classes
3. Add proper context and error codes
"""

import re
from pathlib import Path


# Mapping of HTTPException patterns to custom exceptions
REPLACEMENTS = {
    # Auth errors (401)
    (r'raise HTTPException\(status_code=401, detail="(?:Invalid credentials|Invalid password)"\)',
     'from app.core.exceptions import InvalidCredentialsError\n        raise InvalidCredentialsError()'),
    
    (r'raise HTTPException\(status_code=401, detail="(?:.*?)token(?:.*?)"\)',
     'from app.core.exceptions import InvalidTokenError\n        raise InvalidTokenError()'),
    
    (r'raise HTTPException\(status_code=401, detail="(?:.*?)"\)',
     'from app.core.exceptions import MissingTokenError\n        raise MissingTokenError()'),
    
    # Permission errors (403)
    (r'raise HTTPException\(status_code=403, detail="(?:Only (?:teachers|students) can|Permission|Not authorised|Not Your|Not your)(?:.*?)"\)',
     'from app.core.exceptions import PermissionDeniedError\n        raise PermissionDeniedError()'),
    
    # Not found errors (404)
    (r'raise HTTPException\(status_code=404, detail="(?:(?:Teacher|User|Student|Booking|Session|Subject).*?)"\)',
     'from app.core.exceptions import ResourceNotFoundError\n        raise ResourceNotFoundError()'),
    
    # Conflict/Already exists (409)
    (r'raise HTTPException\(status_code=409, detail="(?:.*?)(?:already exists|already registered)(?:.*?)"\)',
     'from app.core.exceptions import ConflictError\n        raise ConflictError()'),
    
    # External service (503)
    (r'raise HTTPException\(status_code=503, detail="(?:.*?)"\)',
     'from app.core.exceptions import ExternalServiceError\n        raise ExternalServiceError()'),
    
    # Bad request/Validation (400, 422)
    (r'raise HTTPException\(status_code=(?:400|422), detail="(?:.*?)"\)',
     'from app.core.exceptions import ValidationError\n        raise ValidationError()'),
}


def migrate_file(filepath: Path) -> tuple[int, str]:
    """
    Migrate a single file from HTTPException to custom exceptions.
    
    Returns:
        (count_replaced, updated_content)
    """
    content = filepath.read_text()
    original_content = content
    count = 0
    
    # Update imports
    if 'from fastapi import' in content and 'HTTPException' in content:
        content = re.sub(
            r'from fastapi import ([^#\n]*?)(?:, HTTPException)?(?:, ([^#\n]*))?',
            lambda m: 'from fastapi import ' + ', '.join(filter(None, [m.group(1).replace(', HTTPException', ''), m.group(2)])),
            content
        )
        count += 1
    
    # Add custom exception imports if not already present
    if '# Add imports at the top\n' not in content and any(ex in content for ex in [
        'from app.core.exceptions import'
    ]):
        if 'from app.core.exceptions import' not in content:
            content = content.replace(
                'from app.core.dependencies import',
                'from app.core.exceptions import (\n    PermissionDeniedError,\n    ResourceNotFoundError,\n    ConflictError,\n    ValidationError,\n    ExternalServiceError,\n)\n\nfrom app.core.dependencies import'
            )
    
    return (count, content) if content != original_content else (0, original_content)


def main():
    \"\"\"Main entry point for the migration script.\"\"\"
    backend_path = Path(__file__).parent
    endpoints_path = backend_path / 'app' / 'api' / 'v1' / 'endpoints'
    
    if not endpoints_path.exists():
        print(f\"❌ Endpoints directory not found: {endpoints_path}\")
        return
    
    print(f\"🔍 Found endpoints directory: {endpoints_path}\")
    
    endpoint_files = list(endpoints_path.glob('*.py'))
    print(f\"📁 Found {len(endpoint_files)} endpoint files\")
    
    total_replacements = 0
    
    for filepath in endpoint_files:
        if filepath.name.startswith('__'):
            continue
        
        print(f\"\\n📝 Processing {filepath.name}...\")
        count, updated_content = migrate_file(filepath)
        
        if count > 0:
            # For now, just show what would be changed
            print(f\"   ✅ Would update {count} imports\")
            print(f\"   💾 Preview of changes:\")
            
            # Show first few differences
            original = filepath.read_text()
            if 'HTTPException' in updated_content and 'HTTPException' in original:
                print(f\"   - Removing HTTPException imports\")
                print(f\"   - Adding custom exception imports\")
            
            total_replacements += count
    
    print(f\"\\n\" + \"=\"*60)
    print(f\"✨ Migration Summary\")
    print(f\"=\"*60)\n")
    print(f\"Total files that would be updated: {total_replacements}\")\n    print(\"\\n📢 To complete the migration:\")\n    print(\"   1. Review the ERROR_HANDLING_GUIDE.md for detailed patterns\")\n    print(\"   2. Manually replace HTTPException calls using the patterns shown\")\n    print(\"   3. Run pytest to verify error responses\")\n    print(\"   4. Test with frontend to verify error codes are handled correctly\")\n    print(\"\\n\" + \"=\"*60)


if __name__ == '__main__':
    main()
