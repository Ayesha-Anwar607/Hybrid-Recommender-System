from passlib.context import CryptContext

# Set up bcrypt as our hashing algorithm (deprecated="auto" ensures backward compatibility)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Converts a plain text password into a secure, unreadable hash string."""
    if not password:
        raise ValueError("Password cannot be empty")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compares a raw login password with the hashed password from our database.

    Returns False if either password is empty or invalid.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # Handles any corrupt hashes gracefully instead of crashing the server
        return False
