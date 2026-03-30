"""
Encryption service for securing sensitive credentials.
Uses Fernet (AES-128-CBC) symmetric encryption.
"""
import os
import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import get_settings


class CryptoService:
    """Handles encryption/decryption of sensitive data like passwords and tokens."""
    
    _instance: Optional['CryptoService'] = None
    _fernet: Optional[Fernet] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Initialize the Fernet cipher with a key derived from environment."""
        settings = get_settings()
        
        # Get or generate encryption key
        # In production, this should be set via environment variable
        secret_key = os.environ.get('CREDENTIAL_ENCRYPTION_KEY')
        
        if not secret_key:
            # Generate a deterministic key based on a machine-specific value
            # This ensures the same key is used across restarts on the same machine
            # For production, always set CREDENTIAL_ENCRYPTION_KEY in environment
            machine_id = self._get_machine_id()
            secret_key = machine_id
        
        # Derive a proper Fernet key using PBKDF2
        # Salt is static but combined with machine-specific data
        salt = b'rag_support_assistant_v1'
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,  # OWASP recommended minimum
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret_key.encode()))
        self._fernet = Fernet(key)
    
    def _get_machine_id(self) -> str:
        """Get a machine-specific identifier for key derivation."""
        # Combine multiple sources for uniqueness
        identifiers = []
        
        # Try to get machine UUID (Windows)
        try:
            import subprocess
            result = subprocess.run(
                ['wmic', 'csproduct', 'get', 'uuid'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                uuid = result.stdout.strip().split('\n')[-1].strip()
                if uuid and uuid != 'UUID':
                    identifiers.append(uuid)
        except Exception:
            pass
        
        # Fallback: use hostname + username
        import socket
        import getpass
        identifiers.append(socket.gethostname())
        identifiers.append(getpass.getuser())
        
        # Create a hash of all identifiers
        combined = ':'.join(identifiers)
        return hashlib.sha256(combined.encode()).hexdigest()
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a string and return base64-encoded ciphertext.
        
        Args:
            plaintext: The sensitive data to encrypt
            
        Returns:
            Base64-encoded encrypted string, prefixed with 'enc:' marker
        """
        if not plaintext:
            return plaintext
        
        # Don't re-encrypt already encrypted data
        if plaintext.startswith('enc:'):
            return plaintext
        
        encrypted = self._fernet.encrypt(plaintext.encode())
        return f"enc:{encrypted.decode()}"
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt a base64-encoded ciphertext string.
        
        Args:
            ciphertext: The encrypted string (with 'enc:' prefix)
            
        Returns:
            Decrypted plaintext string
            
        Raises:
            ValueError: If decryption fails (wrong key or corrupted data)
        """
        if not ciphertext:
            return ciphertext
        
        # If not encrypted (no prefix), return as-is
        if not ciphertext.startswith('enc:'):
            return ciphertext
        
        try:
            # Remove the 'enc:' prefix
            encrypted_data = ciphertext[4:]
            decrypted = self._fernet.decrypt(encrypted_data.encode())
            return decrypted.decode()
        except InvalidToken:
            raise ValueError(
                "Failed to decrypt credential. The encryption key may have changed. "
                "Please re-enter the credential."
            )
    
    def is_encrypted(self, value: str) -> bool:
        """Check if a value is already encrypted."""
        return value and value.startswith('enc:')


# Singleton accessor
_crypto_service: Optional[CryptoService] = None

def get_crypto_service() -> CryptoService:
    """Get the singleton CryptoService instance."""
    global _crypto_service
    if _crypto_service is None:
        _crypto_service = CryptoService()
    return _crypto_service


def encrypt_credential(value: str) -> str:
    """Convenience function to encrypt a credential."""
    return get_crypto_service().encrypt(value)


def decrypt_credential(value: str) -> str:
    """Convenience function to decrypt a credential."""
    return get_crypto_service().decrypt(value)
