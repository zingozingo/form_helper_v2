# Debug Integration Guide

This guide explains the debug integration system implemented in the AI Form Helper extension. This system allows developers and testers to gain deeper insights into the field detection process, confirm or reject detected fields, and customize detection sensitivity.

## Accessing Debug Mode

1. Open the AI Form Helper panel
2. Look for the bug icon (🐞) in the top-right corner of the panel
3. Click this icon to toggle debug mode on/off

## Debug Panel Features

### Fields Tab

The Fields tab provides detailed information about detected form fields:

- **Field List**: Shows all detected fields with confidence scores
- **Confirmation System**: Allows confirming or rejecting fields for machine learning
- **Highlighting**: Hover over fields to highlight them on the webpage
- **Field Details**: Displays detailed information about each field

### Raw Data Tab

The Raw Data tab shows the raw JSON data for the detected form and fields:

- **Complete Form Object**: Shows the full data structure
- **Debugging Details**: Includes method used, timing, and other metadata
- **Copy Feature**: Easy access to raw data for bug reports

### Learning Tab

The Learning tab displays the machine learning patterns that have been saved:

- **Pattern List**: Shows all confirmed field patterns
- **Stats**: Displays confirmation counts and usage statistics
- **Pattern Details**: Shows examples of each pattern

### Messages Tab

The Messages tab helps track communication between components:

- **Message Log**: Shows all messages between panel and content script
- **Direction Indicators**: Indicates incoming/outgoing messages
- **Timestamps**: Records when each message was sent/received

## Confidence Threshold Adjustment

The debug panel includes a confidence threshold slider:

1. Adjust the slider to set the minimum confidence for field detection
2. Higher values = less fields but higher confidence
3. Lower values = more fields but may include false positives
4. Click "Apply" to filter fields by the new threshold
5. Color-coded indicators show which fields meet the threshold

## Machine Learning System

The debug integration includes a simple machine learning system:

1. **Field Confirmation**: Click "Confirm Field" on correctly detected fields
2. **Pattern Recognition**: System extracts patterns from confirmed fields
3. **Storage**: Patterns are saved in chrome.storage.local
4. **Confidence Boosting**: Fields matching saved patterns get confidence boost
5. **Persistence**: Learning persists across browser sessions

## Field Detection Visualization

The debug integration shows visual feedback on the webpage:

1. **Field Highlighting**: Detected fields are highlighted with borders
2. **Confidence Colors**: Color-coding based on confidence level
   - Green: High confidence (≥0.7)
   - Yellow: Medium confidence (≥0.5)
   - Red: Low confidence (<0.5)
3. **Field Labels**: Labels show field name and confidence score
4. **Interactive**: Hover over fields in debug panel to highlight on page

## Debug Controls

At the bottom of the debug panel:

1. **Re-run Detection**: Force a new detection run
2. **Test Message Passing**: Test communication between components
3. **Save Learning Data**: Manually save pattern data to storage

## Applying Debug Results

After reviewing, confirming, and adjusting fields:

1. Click "Apply & Return" at the top of the debug panel
2. Confirmed fields and those meeting the threshold will be applied
3. The main panel will update with the filtered fields
4. A confirmation message appears in the chat

## Usage Guidelines

1. **Regular Testing**: Use debug mode regularly during development
2. **Pattern Building**: Confirm fields to build a robust pattern database
3. **Confidence Tuning**: Find the optimal threshold for your target sites
4. **Issue Reporting**: Use raw data for detailed bug reports
5. **Performance Testing**: Monitor detection speed for optimization

## Technical Implementation

The debug integration consists of several components:

1. **panel-debug-integration.js**: Main debug panel implementation
2. **debug-field-detection.js**: On-page visualization system
3. **content-field-detection-fix.js**: Message passing enhancements

Each component plays a specific role in the debug system and communicates with the others to provide a comprehensive debugging experience.