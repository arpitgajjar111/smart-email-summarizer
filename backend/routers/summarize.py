"""
Summarize Router
Handles POST /summarize for text and file-based summarization.
"""

import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response

from models.schemas import SummarizeRequest, SummarizeResponse, FileUploadResponse
from services.summarizer import summarize_text, count_words
from services.file_extractor import extract_text
from services import history_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Max file size: 5MB
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.post("/summarize", response_model=SummarizeResponse, summary="Summarize text")
async def summarize(request: SummarizeRequest):
    """
    Summarize the provided text using the specified Hugging Face model.

    - **text**: The text to summarize (50–100,000 characters)
    - **model**: Model to use (bart-large-cnn, pegasus-xsum, or t5-base)
    - **length**: Summary length (short, medium, or detailed)
    """
    try:
        logger.info(
            f"Summarize request | model={request.model} | "
            f"length={request.length} | words={count_words(request.text)}"
        )
        result = summarize_text(
            text=request.text,
            model_name=request.model.value,
            length=request.length.value
        )

        # Save to history
        item_id = history_service.save_summary(
            original_text=request.text,
            **{k: v for k, v in result.items() if k != "processing_time_ms"}
        )
        result["id"] = item_id

        logger.info(
            f"✅ Summary generated | {result['original_word_count']} → "
            f"{result['summary_word_count']} words | "
            f"{result['reduction_percentage']}% reduction | "
            f"{result['processing_time_ms']}ms"
        )
        return SummarizeResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error during summarization")
        raise HTTPException(status_code=500, detail="Internal server error during summarization.")


@router.post("/upload", response_model=FileUploadResponse, summary="Upload and extract file text")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a PDF, DOCX, or TXT file and extract its text content.
    Use the extracted text with POST /summarize to summarize it.

    Max file size: 5MB
    """
    # Validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_FILE_SIZE // (1024*1024)}MB."
        )

    try:
        extracted_text, file_type = extract_text(content, file.filename or "upload")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not extracted_text or len(extracted_text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Could not extract sufficient text from the file. "
                   "Ensure the file contains readable text (not scanned images)."
        )

    return FileUploadResponse(
        filename=file.filename or "upload",
        file_type=file_type,
        extracted_text=extracted_text,
        word_count=count_words(extracted_text),
        char_count=len(extracted_text),
        message=f"Successfully extracted {count_words(extracted_text)} words from {file_type.upper()} file."
    )


@router.get("/models", summary="List available models")
async def list_models():
    """Return the list of available summarization models with descriptions."""
    return {
        "models": [
            {
                "id": "facebook/bart-large-cnn",
                "name": "BART Large CNN",
                "description": "Best for news articles, emails, and structured documents. High quality, moderate speed.",
                "recommended_for": ["emails", "news", "reports"],
            },
            {
                "id": "google/pegasus-xsum",
                "name": "PEGASUS XSum",
                "description": "Generates extremely concise, abstractive summaries. Best for short crisp outputs.",
                "recommended_for": ["quick summaries", "headlines", "short docs"],
            },
            {
                "id": "t5-base",
                "name": "T5 Base",
                "description": "Versatile general-purpose model. Good balance of speed and quality.",
                "recommended_for": ["general text", "articles", "mixed content"],
            },
        ]
    }
