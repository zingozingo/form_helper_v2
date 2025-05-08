# AI Form Helper Extension

This Chrome extension uses advanced form detection and AI to help users fill out web forms more efficiently.

## Key Features

- **Sophisticated Form Detection**: Using a weighted scoring system to identify legitimate forms
- **False Positive Prevention**: Robust checks to avoid triggering on document editors and non-forms
- **Form Context Analysis**: Understand the purpose of forms to provide contextual help
- **Detailed Field Analysis**: Extract field information with context awareness
- **Automated Form Filling**: Fill in forms with appropriate data
- **AI-Powered Assistance**: Get help understanding form fields

## Form Quality Analyzer

The core of our form detection system is the `FormQualityAnalyzer` class, which evaluates forms based on:

- Number of fields and their diversity
- Presence of submit buttons/mechanisms
- Labels and field associations
- Form-specific attributes
- Semantic context matching
- And more...

The analyzer uses a configurable threshold (default: 65/100) to determine if a form is legitimate enough to display the Form Helper UI.

## Test Suite

This extension includes a comprehensive test suite with sample forms:

- **Test Forms**: 10 different forms from legitimate to excluded cases
- **Testing Interface**: UI for running tests and analyzing results
- **Threshold Calibration**: Tools for finding the optimal confidence threshold

To run tests, open `test_launcher.html` from the extension directory.

## Configuration

Adjust settings in `content.js`:

```javascript
const extensionSettings = {
  // Threshold for considering a form legitimate (0-100)
  formQualityThreshold: 75,
  
  // Developer mode toggle
  developerMode: false,
  
  // Strict mode - enforces additional requirements
  strictMode: true,
  
  // Exclusion settings
  excludeSearchForms: true,
  excludeSingleInputForms: true,
  excludeNewsletterForms: true,
  excludeChatInterfaces: true,
  excludeCommentForms: true,
  excludeDocumentEditors: true,
  
  // Domain exclusion list
  excludedDomains: [
    'docs.google.com',
    'office.live.com',
    // ...and other document platforms
  ]
};
```

For more details on false positive prevention, see [false_positive_prevention.md](false_positive_prevention.md)

## Extension Structure

- `formQualityAnalyzer.js`: Advanced form detection engine
- `content.js`: Main content script for form detection and UI
- `form-context-analyzer.js`: Analyzes form context and purpose
- `panel.js`: Side panel UI for form assistance
- `background.js`: Background service worker for extension functionality

## Testing Tools

- `test_forms_for_detection.html`: Test cases for form detection
- `form_detection_test_results.html`: Interface for running tests
- `load_test_forms.js`: Utility for testing forms on any page
- `form_quality_analyzer_testing.md`: Documentation for testing

## Developer Mode

When `developerMode` is set to `true`, the extension:

- Shows useful debugging information in the console
- Displays form scores directly in the UI
- Allows helper UI to appear for forms that don't meet the threshold
- Provides detailed feedback on why forms were accepted or rejected

## Usage

1. Install the extension in Chrome
2. Browse to any page with forms
3. The extension automatically detects legitimate forms
4. Click the Form Helper button that appears next to forms
5. Use the side panel interface to get AI assistance with the form