"""
File Extraction Service
Handles text extraction from PDF and DOCX uploaded files.
"""

import io
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract text from a PDF file using PyMuPDF (fitz).
    Falls back to pdfplumber if fitz is unavailable.
    """
    text = ""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            text += page.get_text()
        doc.close()
        logger.info(f"PDF extracted via PyMuPDF: {len(text)} chars")
        return text.strip()
    except ImportError:
        pass

    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        logger.info(f"PDF extracted via pdfplumber: {len(text)} chars")
        return text.strip()
    except ImportError:
        raise RuntimeError(
            "No PDF library found. Install PyMuPDF: pip install pymupdf\n"
            "Or pdfplumber: pip install pdfplumber"
        )


def extract_text_from_docx(file_bytes: bytes) -> str:
    """
    Extract text from a DOCX file using python-docx.
    """
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
        text = "\n".join(paragraphs)
        logger.info(f"DOCX extracted: {len(text)} chars")
        return text.strip()
    except ImportError:
        raise RuntimeError(
            "python-docx not installed. Run: pip install python-docx"
        )


def extract_text(file_bytes: bytes, filename: str) -> Tuple[str, str]:
    """
    Route file to the appropriate extractor based on extension.

    Returns:
        Tuple of (extracted_text, file_type)
    """
    name_lower = filename.lower()

    if name_lower.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes), "pdf"
    elif name_lower.endswith(".docx"):
        return extract_text_from_docx(file_bytes), "docx"
    elif name_lower.endswith(".txt"):
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")
        return text.strip(), "txt"
    else:
        raise ValueError(
            f"Unsupported file type: {filename}. "
            "Supported formats: .pdf, .docx, .txt"
        )
