# Form Helper - Debug Mode Guide

## Overview

Debug Mode in Form Helper provides additional information to help developers understand the form detection process. When enabled, it displays form scores, detection reasons, and other technical details that are hidden in the regular user experience.

## How to Enable Debug Mode

You can enable Debug Mode through the extension popup:

1. Click on the Form Helper icon in your browser's extension toolbar
2. Find the "Debug Mode" toggle in the Settings section
3. Switch the toggle to ON
4. Open or refresh the page with forms to see debug information

## Debug Mode Features

### Form Score Display

When Debug Mode is enabled, a box appears in the bottom-right corner of the panel showing:

- Form Quality Score (0-100)
- Detection Reason
- Form Type
- Confidence Percentage

### Detailed Field Information

Debug Mode provides additional information about fields:

- Field detection confidence
- Raw field attributes
- Extraction method used
- Field purpose inference details

### Console Logging

Debug Mode also enables additional console logging:

- Detailed form analysis process
- Field extraction steps
- Score calculation breakdown
- Detection rule matching results

## Using Debug Mode for Testing

Debug Mode is particularly useful when:

1. **Testing form detection**: See why forms are or aren't being detected correctly
2. **Developing form detection rules**: Understand which rules are triggering
3. **Troubleshooting field extraction**: Identify why fields might be missing or misinterpreted
4. **Evaluating form quality**: Understand the scoring criteria for form detection

## Note for Developers

The Debug Mode setting is stored with the rest of the Form Helper settings in Chrome's local storage under the `formHelperSettings` key. You can programmatically toggle it by modifying this value through Chrome storage API.

```js
// Example: Programmatically enable debug mode
chrome.storage.local.get(['formHelperSettings'], function(result) {
  if (result.formHelperSettings) {
    result.formHelperSettings.debugMode = true;
    chrome.storage.local.set({formHelperSettings: result.formHelperSettings});
  }
});
```