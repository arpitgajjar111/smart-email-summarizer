# ◈ InkBrief — Smart Email Summarizer

> AI-powered email and document summarization using Hugging Face Transformers (BART · PEGASUS · T5)

A full-stack NLP application built for Data Science portfolios. Paste emails, reports, or articles — get precise, readable summaries in seconds. Includes a Chrome Extension for Gmail.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?logo=fastapi)
![Transformers](https://img.shields.io/badge/🤗_Transformers-4.41-yellow)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Features

| Feature | Details |
|---|---|
| **3 AI Models** | BART-large-CNN · PEGASUS-XSum · T5-base |
| **3 Length Modes** | Short · Medium · Detailed |
| **File Upload** | PDF, DOCX, TXT extraction |
| **Stats Panel** | Word count, char count, % reduction, processing time |
| **History** | In-memory summary history with search |
| **Export** | Copy, Download .txt, Export PDF |
| **Chrome Extension** | Gmail integration with inline "Summarize" button |
| **Dark / Light mode** | Persisted in localStorage |
| **REST API** | FastAPI with interactive Swagger docs |

---

## Project Structure

```
smart-email-summarizer/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── models/
│   │   └── schemas.py           # Pydantic request/response schemas
│   ├── routers/
│   │   ├── summarize.py         # POST /summarize, POST /upload
│   │   └── history.py           # GET/DELETE /history
│   └── services/
│       ├── summarizer.py        # HuggingFace pipeline wrapper
│       ├── file_extractor.py    # PDF & DOCX text extraction
│       └── history_service.py   # In-memory summary store
├── frontend/
│   ├── templates/
│   │   └── index.html           # Single-page application
│   └── static/
│       ├── css/style.css        # Dark/light theme, responsive
│       └── js/app.js            # All UI logic
├── chrome_extension/
│   ├── manifest.json            # MV3 extension manifest
│   ├── popup.html               # Extension popup UI
│   ├── popup.js                 # Popup logic
│   ├── content.js               # Gmail DOM injection
│   ├── background.js            # Service worker
│   └── icons/                   # Extension icons (16, 48, 128px)
├── requirements.txt
├── .gitignore
└── README.md
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- pip
- ~4GB disk space (model downloads)
- Google Chrome (for extension)

---

### 1. Clone & Set Up Virtual Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/smart-email-summarizer.git
cd smart-email-summarizer

# Create virtual environment
python -m venv venv

# Activate it
# macOS / Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

---

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

> **Note on PyTorch:** The default installs the CPU version.  
> For GPU (CUDA 12.1):
> ```bash
> pip install torch --index-url https://download.pytorch.org/whl/cu121
> ```

---

### 3. Run the Backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server starts at **http://localhost:8000**

- **Frontend app**: http://localhost:8000/
- **Swagger UI**: http://localhost:8000/api/docs
- **Health check**: http://localhost:8000/health

> **First summarization request** will download the selected model (~400MB–1.6GB).  
> Subsequent requests use the cached model and are much faster.

---

### 4. Open the Frontend

Navigate to **http://localhost:8000** in your browser.

The frontend is served directly by FastAPI as static files.

---

### 5. Load the Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `chrome_extension/` folder
5. The ◈ InkBrief icon appears in your toolbar

**Using the extension:**
- Open Gmail and navigate to an email
- Click the ◈ InkBrief toolbar icon → **Summarize Email**
- Or look for the **◈ Summarize** button injected directly into the email

---

## API Documentation

### `POST /api/summarize`

Summarize text using a specified model.

**Request:**
```json
{
  "text": "Dear all, this quarter we saw record performance...",
  "model": "facebook/bart-large-cnn",
  "length": "medium"
}
```

**Response:**
```json
{
  "summary": "Q3 saw record performance with 23% revenue growth.",
  "original_word_count": 450,
  "summary_word_count": 82,
  "reduction_percentage": 81.8,
  "model_used": "facebook/bart-large-cnn",
  "length_preset": "medium",
  "processing_time_ms": 1240.5,
  "id": "a3f8b1c2"
}
```

| Field | Values |
|---|---|
| `model` | `facebook/bart-large-cnn` · `google/pegasus-xsum` · `t5-base` |
| `length` | `short` · `medium` · `detailed` |

---

### `POST /api/upload`

Upload a PDF, DOCX, or TXT file to extract text.

**Request:** `multipart/form-data` with `file` field  
**Response:** JSON with `extracted_text`, `word_count`, `char_count`

---

### `GET /api/history`

Retrieve saved summary history.

**Query params:**
- `search` (optional): filter by text
- `limit` (default: 20, max: 100)

---

### `DELETE /api/history/{id}`

Delete a specific history item.

---

### `GET /health`

Returns service status, version, and available models.

---

## Models

| Model | Organization | Best For | Size |
|---|---|---|---|
| `facebook/bart-large-cnn` | Meta AI | Emails, news, reports | ~1.6GB |
| `google/pegasus-xsum` | Google Research | Ultra-concise summaries | ~2.3GB |
| `t5-base` | Google Brain | General text | ~400MB |

**Recommendation:** Start with BART for emails and structured documents.

---

## Configuration

Key settings in `backend/services/summarizer.py`:

```python
# Token limits per model and length preset
LENGTH_CONFIG = {
    "short":    {"facebook/bart-large-cnn": (30, 80), ...},
    "medium":   {"facebook/bart-large-cnn": (80, 180), ...},
    "detailed": {"facebook/bart-large-cnn": (180, 400), ...},
}
```

For GPU inference, change `device=-1` → `device=0` in `get_pipeline()`.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| First request is very slow | Normal – model is downloading/loading (~30-60s) |
| `CUDA out of memory` | Set `device=-1` to use CPU |
| Extension: "No email detected" | Open an email in Gmail (not just the list) |
| `sentencepiece` error | Run `pip install sentencepiece` |
| DOCX extraction fails | Run `pip install python-docx` |

---

## Tech Stack

**Backend:** Python · FastAPI · Uvicorn · Pydantic v2  
**AI/NLP:** Hugging Face Transformers · PyTorch · SentencePiece  
**File Parsing:** PyMuPDF · python-docx  
**Frontend:** Vanilla HTML/CSS/JS · Instrument Serif + Inter + JetBrains Mono  
**Extension:** Chrome MV3 · Content Scripts · Service Worker

---

## License

MIT — free for personal and commercial use.

---

*Built for Data Science portfolios. If this helped you, star the repo ⭐*
