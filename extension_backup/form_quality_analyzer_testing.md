# Testing the Form Quality Analyzer

The FormQualityAnalyzer is a sophisticated system designed to identify legitimate interactive forms while filtering out non-legitimate ones like search boxes, comment fields, etc. This document explains how to test and calibrate the system.

## How to Run the Tests

1. Make sure the extension is loaded in developer mode in Chrome
2. Open the file `form_detection_test_results.html` in Chrome
3. Click the "Run All Tests" button
4. The system will open the test forms page (`test_forms_for_detection.html`) and analyze each form
5. Results will be displayed in the table showing scores and whether each form was correctly identified

## Adjusting the Threshold

- Use the threshold slider to change the confidence threshold (default: 65)
- Click "Apply Threshold" to re-evaluate the test results with the new threshold
- Find the optimal threshold that correctly classifies the most forms

## Understanding the Test Cases

The test suite includes 10 forms:

1. **Login Form (Expected: Legitimate)** - Standard email/password login form
2. **Registration Form (Expected: Legitimate)** - Multi-field signup form with validation
3. **Contact Form (Expected: Legitimate)** - Contact form with name, email, subject and message
4. **Checkout Form (Expected: Legitimate)** - Complex form with billing and payment info
5. **Search Box (Expected: Excluded)** - Simple search form that should be excluded
6. **Newsletter Signup (Expected: Excluded)** - Email subscription form that should be excluded
7. **Comment Form (Expected: Excluded)** - Simple comment form that should be excluded
8. **Chat Interface (Expected: Excluded)** - Chat input that should be excluded
9. **Form with No Labels (Expected: Borderline)** - Form with fields but no proper labels
10. **Form with Hidden Fields (Expected: Legitimate)** - Form containing hidden fields but otherwise legitimate

## Detailed Analysis

Click "Show/Hide Detailed Scores" to view a breakdown of how each form scored on different factors:

- Field Count
- Submit Element
- Label Association
- Field Diversity
- Form Attributes
- Semantic Match
- And more...

These detailed scores help understand why a form was classified as legitimate or not.

## Exporting Results

Click "Export Results" to save the test results as a JSON file for further analysis or record-keeping.

## Real-World Testing

After calibrating with these test forms, you should test the extension on real websites to ensure it performs well in the wild. The developer mode setting in the extension can be used to show form scores on any website.

## Additional Notes

- The FormQualityAnalyzer uses a sophisticated weighted scoring system
- Forms are evaluated based on multiple quality signals (field count, labels, submit buttons, etc.)
- Forms are also checked against known patterns for common form types (login, registration, etc.)
- The system includes specific exclusion patterns for non-legitimate forms
- A high threshold (80+) will be very selective, only showing the helper UI for high-quality forms
- A low threshold (40-50) will be more inclusive but may show the helper UI for some non-legitimate forms