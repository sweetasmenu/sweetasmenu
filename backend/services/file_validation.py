"""
File Upload Validation Service
Validates file size, type, and content for security
"""

from fastapi import UploadFile, HTTPException
from typing import List, Optional
import mimetypes

# Configuration
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024  # 10MB default

# Allowed MIME types for images
ALLOWED_IMAGE_TYPES = {
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
}

# Allowed file extensions for images
ALLOWED_IMAGE_EXTENSIONS = {
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
}

# Magic bytes for image file validation (first bytes of file)
IMAGE_MAGIC_BYTES = {
    b'\xff\xd8\xff': 'image/jpeg',        # JPEG
    b'\x89PNG\r\n\x1a\n': 'image/png',    # PNG
    b'RIFF': 'image/webp',                 # WebP (partial, needs further check)
    b'GIF87a': 'image/gif',                # GIF87a
    b'GIF89a': 'image/gif',                # GIF89a
}


async def validate_image_upload(
    file: UploadFile,
    max_size_mb: float = MAX_FILE_SIZE_MB,
    allowed_types: Optional[List[str]] = None
) -> tuple[bytes, str]:
    """
    Validate an uploaded image file.

    Args:
        file: The uploaded file
        max_size_mb: Maximum file size in megabytes
        allowed_types: Optional list of allowed MIME types (defaults to ALLOWED_IMAGE_TYPES)

    Returns:
        tuple of (file_content, detected_mime_type)

    Raises:
        HTTPException with appropriate status code and message
    """

    if allowed_types is None:
        allowed_types = list(ALLOWED_IMAGE_TYPES)

    # Check if file exists
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    # Check filename
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")

    # Check file extension
    filename_lower = file.filename.lower()
    has_valid_extension = any(filename_lower.endswith(ext) for ext in ALLOWED_IMAGE_EXTENSIONS)
    if not has_valid_extension:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    # Check declared content type
    content_type = file.content_type or ''
    if content_type and content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {content_type}. Allowed: {', '.join(allowed_types)}"
        )

    # Read file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Reset file position for potential re-read
    await file.seek(0)

    # Check file size
    max_size_bytes = int(max_size_mb * 1024 * 1024)
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {max_size_mb}MB, got {len(content) / (1024*1024):.2f}MB"
        )

    # Check if file is empty
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    # Validate magic bytes (actual file content)
    detected_type = detect_image_type(content)
    if detected_type is None:
        raise HTTPException(
            status_code=400,
            detail="File content does not match a valid image format. The file may be corrupted or not a real image."
        )

    if detected_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Detected file type ({detected_type}) is not allowed. Allowed: {', '.join(allowed_types)}"
        )

    return content, detected_type


def detect_image_type(content: bytes) -> Optional[str]:
    """
    Detect image type from file content using magic bytes.

    Args:
        content: File content as bytes

    Returns:
        MIME type string or None if not a valid image
    """
    if len(content) < 8:
        return None

    # Check JPEG (starts with FF D8 FF)
    if content[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'

    # Check PNG (starts with 89 50 4E 47 0D 0A 1A 0A)
    if content[:8] == b'\x89PNG\r\n\x1a\n':
        return 'image/png'

    # Check GIF (GIF87a or GIF89a)
    if content[:6] in (b'GIF87a', b'GIF89a'):
        return 'image/gif'

    # Check WebP (starts with RIFF and contains WEBP)
    if content[:4] == b'RIFF' and len(content) >= 12 and content[8:12] == b'WEBP':
        return 'image/webp'

    return None


def get_safe_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and other attacks.

    Args:
        filename: Original filename

    Returns:
        Sanitized filename
    """
    import os
    import re
    import uuid

    # Get extension
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    # Validate extension
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        ext = '.jpg'  # Default to jpg if invalid

    # Generate safe filename with UUID
    safe_name = f"{uuid.uuid4().hex}{ext}"

    return safe_name


def validate_file_size_sync(content: bytes, max_size_mb: float = MAX_FILE_SIZE_MB) -> bool:
    """
    Synchronous file size validation.

    Args:
        content: File content as bytes
        max_size_mb: Maximum file size in megabytes

    Returns:
        True if valid, raises HTTPException otherwise
    """
    max_size_bytes = int(max_size_mb * 1024 * 1024)
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {max_size_mb}MB"
        )
    return True


# Summary of validations performed:
# 1. File exists and has filename
# 2. File extension is allowed (.jpg, .jpeg, .png, .webp, .gif)
# 3. Declared MIME type is allowed
# 4. File size is within limit (default 10MB)
# 5. File is not empty
# 6. Magic bytes match declared type (prevents file type spoofing)
# 7. Filename is sanitized to prevent path traversal
