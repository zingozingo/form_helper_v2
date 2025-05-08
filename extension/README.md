# AI Form Helper Extension

This Chrome extension uses advanced form detection and AI to help users fill out web forms more efficiently.

## IMPORTANT UPDATE: New Opt-In Architecture

The extension has been completely redesigned with an **opt-in model** where:

1. The extension is **OFF by default** on ALL sites
2. Content scripts are **not automatically injected** into any page
3. User must explicitly click "Analyze This Page" in the popup
4. Only then does the extension run its analysis and show UI
5. Users can maintain an allowlist of sites where the extension is active

This architectural change prevents the extension from appearing inappropriately on non-form websites like social media platforms.

## Key Features

- **Sophisticated Form Detection**: Using a weighted scoring system to identify legitimate forms
- **False Positive Prevention**: Robust checks to avoid triggering on document editors and non-forms
- **Form Context Analysis**: Understand the purpose of forms to provide contextual help
- **Detailed Field Analysis**: Extract field information with context awareness
- **Automated Form Filling**: Fill in forms with appropriate data
- **AI-Powered Assistance**: Get help understanding form fields
- **Opt-In Activation**: User explicitly controls where the extension runs

## How to Use

1. Install the extension in Chrome
2. Click on the extension icon to open the popup
3. Toggle "Allow on this site" to add the site to your allowlist
4. Click "Analyze This Page" to activate form analysis
5. View detected form fields directly in the popup
6. Manage your allowlist of sites in Settings

## Technical Implementation

### Allowlist System

The extension maintains a user-controlled allowlist of domains where it's permitted to run:

- Use the toggle in the popup to add/remove sites from your allowlist
- View and manage all allowed sites in the Settings page
- The extension remembers your choices between browser sessions

### Form Quality Analyzer

The core of our form detection system is the `FormQualityAnalyzer` class, which evaluates forms based on:

- Number of fields and their diversity
- Presence of submit buttons/mechanisms
- Labels and field associations
- Form-specific attributes
- Semantic context matching
- And more...

The analyzer uses a configurable threshold (default: 65/100) to determine if a form is legitimate enough to display the Form Helper UI.

## Extension Structure

- `manifest.json`: Extension configuration with declarativeNetRequest rules
- `background.js`: Background service worker for controlled script injection
- `popup.html/js`: User interface for explicit activation
- `form-analyzer.js`: Injected script for form analysis
- `rules.json`: Blocking rules for social media sites
- `formQualityAnalyzer.js`: Advanced form detection engine
- `form-context-analyzer.js`: Analyzes form context and purpose

## Configuration

The extension uses the following configurable components:

1. **Allowlist**: Stored in `chrome.storage.local` as `formhelper_allowlist`
2. **Detection Threshold**: Configurable in settings
3. **Blocking Rules**: Defined in `rules.json`

## Developer Mode

When `developerMode` is set to `true` in settings, the extension:

- Shows useful debugging information in the console
- Displays form scores directly in the UI
- Provides detailed feedback on why forms were accepted or rejected

## Testing Tools

- `test_forms_for_detection.html`: Test cases for form detection
- `form_detection_test_results.html`: Interface for running tests
- `load_test_forms.js`: Utility for testing forms on any page
- `form_quality_analyzer_testing.md`: Documentation for testing

For more details on false positive prevention, see [false_positive_prevention.md](false_positive_prevention.md)