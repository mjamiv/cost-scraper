"""
Tests for authentication module.
"""

import pytest
from datetime import timedelta
from jose import jwt

from app.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token,
    authenticate_user,
    get_user,
    SECRET_KEY,
    ALGORITHM
)


class TestPasswordHashing:
    """Tests for password hashing functions."""
    
    def test_password_hash_creates_different_hashes(self):
        """Same password should create different hashes (salted)."""
        password = "test_password123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        
        assert hash1 != hash2
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)
    
    def test_verify_password_correct(self):
        """Correct password should verify successfully."""
        password = "secure_password"
        hashed = get_password_hash(password)
        
        assert verify_password(password, hashed) is True
    
    def test_verify_password_incorrect(self):
        """Incorrect password should fail verification."""
        password = "correct_password"
        wrong_password = "wrong_password"
        hashed = get_password_hash(password)
        
        assert verify_password(wrong_password, hashed) is False


class TestJWTTokens:
    """Tests for JWT token creation and validation."""
    
    def test_create_access_token(self):
        """Token should be created with correct data."""
        data = {"sub": "test_user", "scopes": ["read"]}
        token = create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_create_access_token_with_expiry(self):
        """Token should include custom expiry."""
        data = {"sub": "test_user"}
        expires = timedelta(minutes=30)
        token = create_access_token(data, expires_delta=expires)
        
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in decoded
        assert decoded["sub"] == "test_user"
    
    def test_decode_token_valid(self):
        """Valid token should decode successfully."""
        data = {"sub": "test_user", "scopes": ["read", "write"]}
        token = create_access_token(data)
        
        token_data = decode_token(token)
        
        assert token_data.username == "test_user"
        assert "read" in token_data.scopes
        assert "write" in token_data.scopes
    
    def test_decode_token_expired(self):
        """Expired token should raise error."""
        from jose import JWTError
        
        data = {"sub": "test_user"}
        expires = timedelta(seconds=-1)  # Already expired
        token = create_access_token(data, expires_delta=expires)
        
        with pytest.raises(JWTError):
            decode_token(token)
    
    def test_decode_token_invalid(self):
        """Invalid token should raise error."""
        from jose import JWTError
        
        with pytest.raises(JWTError):
            decode_token("invalid.token.here")


class TestUserAuthentication:
    """Tests for user authentication functions."""
    
    def test_get_user_existing(self):
        """Should return user if exists in database."""
        user = get_user("admin")
        
        assert user is not None
        assert user.username == "admin"
        assert "admin" in user.scopes
    
    def test_get_user_nonexistent(self):
        """Should return None for non-existent user."""
        user = get_user("nonexistent_user")
        
        assert user is None
    
    def test_authenticate_user_valid(self):
        """Valid credentials should authenticate successfully."""
        # Note: Demo password is "demo123"
        user = authenticate_user("admin", "demo123")
        
        assert user is not None
        assert user.username == "admin"
    
    def test_authenticate_user_wrong_password(self):
        """Wrong password should fail authentication."""
        user = authenticate_user("admin", "wrong_password")
        
        assert user is None
    
    def test_authenticate_user_nonexistent(self):
        """Non-existent user should fail authentication."""
        user = authenticate_user("nonexistent", "any_password")
        
        assert user is None
