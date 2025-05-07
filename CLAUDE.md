# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Form Helper v2 is an AI-powered browser extension that helps users fill out forms on websites. It consists of a Python FastAPI backend and a Chrome extension frontend. The extension detects forms on web pages, analyzes their structure, and provides assistance through a side panel interface with field explanations and auto-fill capabilities.

## Environment Setup

1. Create a `.env` file in the backend directory with the following variables:
   ```
   OPENAI_API_KEY=your_api_key
   ANTHROPIC_API_KEY=your_api_key (optional)
   AI_PROVIDER=openai (or anthropic)
   ```

## Commands

### Running the Backend

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the development server
python run.py
```

### Running Tests

```bash
# Navigate to the project root directory
cd /path/to/form_helper_v2

# Run all tests
python -m pytest tests/

# Run specific test files
python -m pytest tests/test_factory.py
python -m pytest tests/test_html_processor.py
python -m pytest tests/test_pdf_processor.py

# Run integration tests in the backend directory
cd backend
python test_integration.py
```

### Testing the API Server Independently

```bash
# Run the test server
cd backend
python test_server.py
```

## Architecture

### Backend Components

1. **API Layer** (`backend/api/`):
   - `main.py`: FastAPI application setup
   - Routes for form processing, AI assistance, and user profiles

2. **Core Modules** (`backend/core/`):
   - Form processors for different document types (HTML/PDF)
   - AI assistance system with hybrid approach (local knowledge + API)
   - Database models and connection management

3. **Form Processing** (`backend/core/form_processor/`):
   - Factory pattern implementation for different form types
   - Specialized processors for HTML and PDF forms

4. **AI System** (`backend/core/ai/`):
   - `hybrid_copilot.py`: Main AI system combining local knowledge and external APIs
   - `field_knowledge.json`: Database of common field explanations

### Extension Components

1. **Content Script** (`extension/content.js`):
   - Form detection and field analysis on web pages
   - Communication with backend API

2. **Side Panel** (`extension/panel.html`, `extension/panel.js`):
   - User interface for form assistance
   - Field highlighting and auto-fill functionality

3. **Background Script** (`extension/background.js`):
   - Manages communication between content scripts and panel

## Key Features

1. Intelligent form field detection and analysis
2. Context-aware field explanations using AI
3. Auto-fill capabilities with profile management
4. Support for both HTML and PDF forms

## Important Development Notes

1. When modifying the API endpoints, ensure compatibility with the extension's expected routes
2. The system uses a hybrid AI approach - modify both `field_knowledge.json` and AI prompts when enhancing field explanations
3. Form processors follow the factory pattern - add new processor types by extending the base class and registering with the factory