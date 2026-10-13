"""Create the single analyst account. Usage: python -m scripts.create_user"""
import getpass
from sqlalchemy import select

from app.core.security import hash_password
from app.db.models import User
from app.db.session import Base, SessionLocal, engine


def main():
    Base.metadata.create_all(engine)
    username = input("Username: ").strip()
    email = input("Email (optional): ").strip() or None
    pw = getpass.getpass("Password: ")
    if len(pw) < 8:
        raise SystemExit("Password must be at least 8 characters.")
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)) is not None:
            raise SystemExit("A user already exists (single-user app).")
        db.add(User(username=username, email=email, password_hash=hash_password(pw)))
        db.commit()
    print("User created.")


if __name__ == "__main__":
    main()
