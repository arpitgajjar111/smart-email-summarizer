"""
Pydantic schemas for Smart Email Summarizer API
Defines all request and response data models with validation
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ModelType(str, Enum):
    """Supported Hugging Face summarization models."""
    BART = "facebook/bart-large-cnn"
    PEGASUS = "google/pegasus-xsum"
    T5 = "t5-base"


class SummaryLength(str, Enum):
    """Summary length options."""
    SHORT = "short"
    MEDIUM = "medium"
    DETAILED = "detailed"


class SummarizeRequest(BaseModel):
    """Request schema for text summarization."""
    text: str = Field(
        ...,
        min_length=50,
        max_length=100000,
        description="Text to summarize (min 50, max 100,000 characters)"
    )
    model: ModelType = Field(
        default=ModelType.BART,
        description="Hugging Face model to use for summarization"
    )
    length: SummaryLength = Field(
        default=SummaryLength.MEDIUM,
        description="Desired summary length"
    )

    @validator("text")
    def validate_text(cls, v):
        stripped = v.strip()
        if len(stripped.split()) < 20:
            raise ValueError("Text must contain at least 20 words to summarize meaningfully.")
        return stripped

    class Config:
        schema_extra = {
            "example": {
                "text": "Dear Team, I wanted to follow up on our Q3 performance review...",
                "model": "facebook/bart-large-cnn",
                "length": "medium"
            }
        }


class SummarizeResponse(BaseModel):
    """Response schema for summarization results."""
    summary: str = Field(..., description="Generated summary text")
    original_word_count: int = Field(..., description="Word count of original text")
    summary_word_count: int = Field(..., description="Word count of summary")
    reduction_percentage: float = Field(..., description="Percentage reduction in word count")
    model_used: str = Field(..., description="Model used for summarization")
    length_preset: str = Field(..., description="Length preset used")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")
    id: Optional[str] = Field(None, description="Unique ID for this summary (for history)")

    class Config:
        schema_extra = {
            "example": {
                "summary": "The Q3 performance exceeded expectations with 23% revenue growth.",
                "original_word_count": 450,
                "summary_word_count": 85,
                "reduction_percentage": 81.1,
                "model_used": "facebook/bart-large-cnn",
                "length_preset": "medium",
                "processing_time_ms": 1240.5,
                "id": "abc123"
            }
        }


class FileUploadResponse(BaseModel):
    """Response schema for file upload and extraction."""
    filename: str
    file_type: str
    extracted_text: str
    word_count: int
    char_count: int
    message: str


class HistoryItem(BaseModel):
    """Schema for a saved summary history item."""
    id: str
    original_preview: str = Field(..., description="First 150 chars of original text")
    summary: str
    model_used: str
    length_preset: str
    original_word_count: int
    summary_word_count: int
    reduction_percentage: float
    created_at: datetime


class HistoryResponse(BaseModel):
    """Response schema for history list."""
    items: List[HistoryItem]
    total: int


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str
    timestamp: str
    version: str
    models_available: List[str]


class ErrorResponse(BaseModel):
    """Standard error response schema."""
    error: str
    detail: Optional[str] = None
    status_code: int
