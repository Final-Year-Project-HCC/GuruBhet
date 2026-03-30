#!/usr/bin/env python
"""
GuruBhet Admin Management CLI

This script provides command-line utilities for managing admin accounts
and other superuser-level operations.

Usage:
    python admin_cli.py create-superuser
    python admin_cli.py create-admin --email admin@gurubhet.com --role VERIFIER
    python admin_cli.py deactivate-admin --email admin@gurubhet.com
    python admin_cli.py list-admins
"""

import asyncio
import argparse
import sys
from uuid import uuid4
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.enums import UserRole, AdminRole
from app.core.security import hash_password
from app.models.user import User
from app.db.base import Base


async def get_session():
    """Create a database session."""
    engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session


async def create_superuser():
    """Create the initial superuser account."""
    engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("\n=== GuruBhet Superuser Creation ===\n")
        print("This will create the root superuser account.")
        print("Keep this password extremely secure!\n")

        first_name = input("First name: ").strip()
        if not first_name:
            print("❌ First name required")
            return

        last_name = input("Last name: ").strip()
        if not last_name:
            print("❌ Last name required")
            return

        email = input("Email address: ").strip().lower()
        if not email or "@" not in email:
            print("❌ Valid email required")
            return

        # Check if user exists
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"❌ User with email {email} already exists")
            return

        password = input("Password (min 8 chars, 1 uppercase, 1 digit): ").strip()
        if len(password) < 8:
            print("❌ Password must be at least 8 characters")
            return

        confirm = input("Confirm password: ").strip()
        if password != confirm:
            print("❌ Passwords don't match")
            return

        # Create superuser
        superuser = User(
            id=uuid4(),
            first_name=first_name,
            last_name=last_name,
            email=email,
            password_hash=hash_password(password),
            role=UserRole.STUDENT,
            is_email_verified=True,
            is_active=True,
            is_banned=False,
            is_superuser=True,
            is_staff=True,
            admin_role=AdminRole.SUPER_ADMIN,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(superuser)
        await db.commit()

        print(f"\n✅ Superuser created successfully!")
        print(f"   Email: {email}")
        print(f"   ID: {superuser.id}")
        print(f"\n⚠️  Keep this password secure and stored safely.\n")


async def create_admin(email: str, role: str, password: str = None):
    """Create a new admin staff member."""
    if role not in [r.value for r in AdminRole]:
        print(f"❌ Invalid role. Must be one of: {[r.value for r in AdminRole]}")
        return

    engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Check superuser exists
        result = await db.execute(select(User).where(User.is_superuser.is_(True)))
        if not result.scalar_one_or_none():
            print("❌ No superuser found. Create superuser first.")
            return

        # Check if admin exists
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"❌ User with email {email} already exists")
            return

        if not password:
            password = input(f"Password for {email}: ").strip()

        # Create admin
        admin = User(
            id=uuid4(),
            first_name=email.split("@")[0],
            last_name="Admin",
            email=email,
            password_hash=hash_password(password),
            role=UserRole.STUDENT,
            is_email_verified=True,
            is_active=True,
            is_banned=False,
            is_superuser=False,
            is_staff=True,
            admin_role=AdminRole(role),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(admin)
        await db.commit()

        print(f"✅ Admin created: {email} ({role})")


async def deactivate_admin(email: str):
    """Deactivate an admin account."""
    engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            print(f"❌ User {email} not found")
            return

        if not user.is_staff:
            print(f"❌ {email} is not a staff member")
            return

        if user.is_superuser:
            print("❌ Cannot deactivate superuser")
            return

        user.is_active = False
        await db.commit()
        print(f"✅ Admin deactivated: {email}")


async def list_admins():
    """List all active admins."""
    engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.is_staff.is_(True), User.is_active.is_(True))
        )
        admins = result.scalars().all()

        if not admins:
            print("No active admins found")
            return

        print("\n=== Active Admins ===\n")
        print(f"{'Email':<30} {'Role':<15} {'Active':<10}")
        print("-" * 55)
        for admin in admins:
            role = admin.admin_role.value if admin.admin_role else "N/A"
            status = "Yes" if admin.is_active else "No"
            print(f"{admin.email:<30} {role:<15} {status:<10}")
        print()


async def main():
    parser = argparse.ArgumentParser(description="GuruBhet Admin Management CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Create superuser
    subparsers.add_parser("create-superuser", help="Create initial superuser account")

    # Create admin
    create_admin_parser = subparsers.add_parser("create-admin", help="Create a new admin")
    create_admin_parser.add_argument("--email", required=True, help="Admin email")
    create_admin_parser.add_argument(
        "--role", required=True, help="Admin role (VERIFIER, FINANCE, SUPPORT, SUPER_ADMIN)"
    )
    create_admin_parser.add_argument("--password", help="Admin password (prompted if not provided)")

    # Deactivate admin
    deactivate_parser = subparsers.add_parser("deactivate-admin", help="Deactivate an admin")
    deactivate_parser.add_argument("--email", required=True, help="Admin email")

    # List admins
    subparsers.add_parser("list-admins", help="List all active admins")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "create-superuser":
        await create_superuser()
    elif args.command == "create-admin":
        await create_admin(args.email, args.role, args.password)
    elif args.command == "deactivate-admin":
        await deactivate_admin(args.email)
    elif args.command == "list-admins":
        await list_admins()


if __name__ == "__main__":
    asyncio.run(main())
