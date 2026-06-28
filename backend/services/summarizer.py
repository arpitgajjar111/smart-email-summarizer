"""
Summarization Service
Handles model loading, caching, and text summarization using Hugging Face Transformers.
Supports BART, PEGASUS, and T5 models with configurable length presets.
"""

import time
import logging
from typing import Dict, Tuple
from functools import lru_cache

logger = logging.getLogger(__name__)

# Length presets: (min_length, max_length) in tokens
LENGTH_CONFIG: Dict[str, Dict[str, Tuple[int, int]]] = {
    "short": {
        "facebook/bart-large-cnn": (30, 80),
        "google/pegasus-xsum": (20, 60),
        "t5-base": (30, 80),
    },
    "medium": {
        "facebook/bart-large-cnn": (80, 180),
        "google/pegasus-xsum": (50, 130),
        "t5-base": (80, 180),
    },
    "detailed": {
        "facebook/bart-large-cnn": (180, 400),
        "google/pegasus-xsum": (100, 250),
        "t5-base": (180, 400),
    },
}

# Model prefix for T5 (requires task prefix)
T5_PREFIX = "summarize: "

# Cache for loaded pipelines to avoid reloading on every request
_pipeline_cache: Dict[str, object] = {}


def get_pipeline(model_name: str):
    """
    Load and cache a summarization pipeline.
    Uses a module-level dict as a simple cache to avoid repeated model loading.
    """
    if model_name not in _pipeline_cache:
        try:
            from transformers import pipeline
            logger.info(f"Loading model: {model_name} (first-time load may take a minute)...")
            _pipeline_cache[model_name] = pipeline(
                "summarization",
                model=model_name,
                device=-1  # CPU; set to 0 for GPU if available
            )
            logger.info(f"✅ Model loaded: {model_name}")
        except Exception as e:
            logger.error(f"❌ Failed to load model {model_name}: {e}")
            raise RuntimeError(
                f"Could not load model '{model_name}'. "
                f"Ensure transformers and torch are installed and the model is available. "
                f"Error: {str(e)}"
            )
    return _pipeline_cache[model_name]


def count_words(text: str) -> int:
    """Count words in a string."""
    return len(text.split())


def summarize_text(text: str, model_name: str, length: str) -> dict:
    """
    Summarize text using the specified model and length preset.

    Args:
        text: Input text to summarize
        model_name: Hugging Face model identifier
        length: One of 'short', 'medium', 'detailed'

    Returns:
        dict with summary, word counts, reduction %, and processing time
    """
    start_time = time.time()

    # Validate length preset
    if length not in LENGTH_CONFIG:
        raise ValueError(f"Invalid length '{length}'. Choose from: short, medium, detailed")

    # Get token limits for this model+length combo
    config = LENGTH_CONFIG[length]
    model_config = config.get(model_name, config.get("facebook/bart-large-cnn"))
    min_length, max_length = model_config

    # T5 requires a task prefix
    input_text = f"{T5_PREFIX}{text}" if model_name == "t5-base" else text

    # Truncate very long texts to model's practical limit (~1024 tokens ≈ ~750 words)
    words = input_text.split()
    max_words = 750
    if len(words) > max_words:
        logger.warning(f"Text truncated from {len(words)} to {max_words} words for model input.")
        input_text = " ".join(words[:max_words])

    try:
        summarizer = get_pipeline(model_name)
        result = summarizer(
            input_text,
            min_length=min_length,
            max_length=max_length,
            do_sample=False,
            truncation=True,
        )
        summary = result[0]["summary_text"].strip()
    except Exception as e:
        logger.error(f"Summarization failed with model {model_name}: {e}")
        raise RuntimeError(f"Summarization failed: {str(e)}")

    # Calculate stats
    original_count = count_words(text)
    summary_count = count_words(summary)
    reduction = round((1 - summary_count / max(original_count, 1)) * 100, 1)
    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "summary": summary,
        "original_word_count": original_count,
        "summary_word_count": summary_count,
        "reduction_percentage": reduction,
        "model_used": model_name,
        "length_preset": length,
        "processing_time_ms": elapsed_ms,
    }
