# backend/core/ai/field_knowledge.py

# Field knowledge base - comprehensive information about common form fields
FIELD_KNOWLEDGE = {
    "email": {
        "purpose": "This field is for your email address, which is used for account creation, login credentials, and communications from the service.",
        "format": "Enter a valid email in the format username@domain.com",
        "examples": ["john.doe@example.com", "jane_smith123@company.co.uk"],
        "validation": "Must contain an @ symbol and a valid domain name.",
        "privacy": "Often used as a unique identifier. Consider the privacy implications."
    },
    "password": {
        "purpose": "This field is for your password, which secures your account from unauthorized access.",
        "format": "Create a strong password with at least 8 characters, including uppercase and lowercase letters, numbers, and special characters.",
        "tips": "Create a unique password not used on other sites. Consider using a password manager.",
        "validation": "Often requires a combination of uppercase, lowercase, numbers, and symbols.",
        "privacy": "Never share your password with anyone. Legitimate organizations will never ask for it."
    },
    "name": {
        "purpose": "This field is for your full name, which identifies you in the system and on documents.",
        "format": "Enter your name as it appears on official documents.",
        "examples": ["John Smith", "María García López"],
        "privacy": "Basic personal information required for identification."
    },
    "first_name": {
        "purpose": "This field is for your first/given name only.",
        "format": "Enter just your first name, without your last/family name.",
        "examples": ["John", "María", "Li"],
        "privacy": "Basic personal information often required for personalization."
    },
    "last_name": {
        "purpose": "This field is for your last/family name only.",
        "format": "Enter just your last name, without your first/given name.",
        "examples": ["Smith", "García", "Zhang"],
        "privacy": "Basic personal information often required for identification."
    },
    "phone": {
        "purpose": "This field is for your phone number, which may be used for account verification, two-factor authentication, or contact purposes.",
        "format": "Enter your phone number including country code if required.",
        "examples": ["+1 555-123-4567", "(555) 123-4567"],
        "privacy": "Consider privacy implications when providing your phone number."
    },
    "tel": {
        "purpose": "This field is for your telephone number, which may be used for account verification, two-factor authentication, or contact purposes.",
        "format": "Enter your phone number including country code if required.",
        "examples": ["+1 555-123-4567", "(555) 123-4567"],
        "privacy": "Consider privacy implications when providing your phone number."
    },
    "address": {
        "purpose": "This field is for your street address, which is needed for shipping, billing, or identification purposes.",
        "format": "Enter your complete street address including house/apartment number and street name.",
        "examples": ["123 Main Street Apt 4B", "1600 Pennsylvania Avenue NW"],
        "privacy": "Sensitive personal information. Be cautious about where you share it."
    },
    "city": {
        "purpose": "This field is for your city or town name, which helps complete your address information.",
        "format": "Enter the name of your city or town.",
        "examples": ["New York", "London", "Tokyo"]
    },
    "state": {
        "purpose": "This field is for your state, province, or region, which helps complete your address information.",
        "format": "Enter the full name or standard abbreviation of your state/province.",
        "examples": ["California", "CA", "Ontario", "ON"]
    },
    "zip": {
        "purpose": "This field is for your postal code or ZIP code, which is required for mail delivery and location verification.",
        "format": "Enter your postal code in the format used by your country.",
        "examples": ["90210", "SW1A 1AA"],
        "validation": "Must match the city and state provided."
    },
    "country": {
        "purpose": "This field is for your country, which completes your address and may determine available options or pricing.",
        "format": "Select your country from the dropdown or enter its name.",
        "examples": ["United States", "Canada", "Germany"]
    },
    "date": {
        "purpose": "This field is for entering a specific date.",
        "format": "Enter the date in the required format (often MM/DD/YYYY in the US or DD/MM/YYYY elsewhere).",
        "examples": ["05/15/2023", "15/05/2023"]
    },
    "date_of_birth": {
        "purpose": "This field is for your date of birth, which helps verify your identity and age eligibility.",
        "format": "Enter your birth date in the required format, typically MM/DD/YYYY in the US.",
        "examples": ["01/15/1985", "15/01/1985"],
        "privacy": "Sensitive personal information often used for identity verification.",
        "tips": "Make sure to use the correct format as indicated by the form (MM/DD/YYYY vs DD/MM/YYYY)."
    },
    "dob": {
        "purpose": "This field is for your date of birth, which helps verify your identity and age eligibility.",
        "format": "Enter your birth date in the required format, typically MM/DD/YYYY in the US.",
        "examples": ["01/15/1985", "15/01/1985"],
        "privacy": "Sensitive personal information often used for identity verification."
    },
    "ssn": {
        "purpose": "This field is for your Social Security Number (SSN), which is used for tax reporting and identity verification in the United States.",
        "format": "Enter your 9-digit SSN, with or without hyphens depending on the form requirements.",
        "examples": ["123-45-6789", "123456789"],
        "privacy": "Highly sensitive personal information. Only provide on secure websites."
    },
    "credit_card": {
        "purpose": "This field is for your credit card number, which is required to process payments.",
        "format": "Enter the 16-digit number from your credit card without spaces or hyphens, unless otherwise specified.",
        "examples": ["4111111111111111", "4111-1111-1111-1111"],
        "validation": "Must be a valid card number that passes the Luhn algorithm check.",
        "privacy": "Highly sensitive financial information. Only provide on secure websites (https)."
    },
    "cvv": {
        "purpose": "This field is for your card verification value (CVV), a security code that helps verify you have physical possession of the card.",
        "format": "Enter the 3 or 4 digit security code found on the back (or front for American Express) of your card.",
        "examples": ["123", "4567"],
        "validation": "Must be the correct number of digits for the card type.",
        "privacy": "Sensitive security information that should never be stored by merchants."
    },
    "gender": {
        "purpose": "This field is for your gender, which may be collected for demographic purposes or to personalize services.",
        "format": "Select or enter your gender according to the options provided.",
        "examples": ["Male", "Female", "Non-binary", "Prefer not to say"],
        "privacy": "Personal information that some may consider sensitive."
    },
    "checkbox": {
        "purpose": "Checkboxes allow you to select multiple options or indicate agreement to terms and conditions.",
        "format": "Click the box to select it, click again to deselect.",
        "examples": ["☑ I agree to the Terms of Service", "☑ Send me promotional emails"]
    },
    "radio": {
        "purpose": "Radio buttons allow you to select exactly one option from a group of choices.",
        "format": "Click on the option you want to select. Only one can be selected at a time.",
        "examples": ["○ Yes ● No", "○ Small ● Medium ○ Large"]
    },
    "file": {
        "purpose": "This field allows you to upload documents or images required for your application or account.",
        "format": "Click to browse your files or drag and drop the file into the designated area.",
        "examples": ["Upload your ID", "Upload a profile picture"]
    },
    "select": {
        "purpose": "This dropdown field allows you to choose one option from a predefined list.",
        "format": "Click on the dropdown and select the appropriate option from the list.",
        "examples": ["Choose your country", "Select your preferred language"]
    }
}

# Name variations to map common field name variations to the standardized knowledge base
NAME_VARIATIONS = {
    "fname": "first_name",
    "firstname": "first_name", 
    "first": "first_name",
    "lname": "last_name",
    "lastname": "last_name", 
    "last": "last_name",
    "fullname": "name",
    "full_name": "name",
    "phone_number": "phone",
    "telephone": "tel",
    "mobile": "phone",
    "cell": "phone",
    "phonenumber": "phone",
    "emailaddress": "email",
    "mail": "email",
    "e-mail": "email",
    "pwd": "password",
    "pass": "password",
    "passwd": "password",
    "current-password": "password",
    "new-password": "password",
    "user": "username",
    "userid": "username",
    "login": "username",
    "birthday": "dob",
    "birth_date": "dob",
    "birthdate": "dob",
    "date_of_birth": "dob",
    "street": "address",
    "addr": "address",
    "addressline1": "address",
    "address1": "address",
    "address_line_1": "address",
    "zipcode": "zip",
    "postal": "zip",
    "postalcode": "zip",
    "postcode": "zip",
    "ccnumber": "credit_card",
    "cc_number": "credit_card",
    "cardnumber": "credit_card",
    "card_number": "credit_card",
    "cc": "credit_card",
    "ccv": "cvv",
    "cvc": "cvv",
    "security_code": "cvv",
    "card_verification": "cvv",
    "expiry": "expiration",
    "exp_date": "expiration",
    "expdate": "expiration",
    "card_expiration": "expiration"
}

# You could also add your common questions from the JSON
COMMON_QUESTIONS = {
    "what is this form for": "This form collects the necessary information to process your request or application. The specific purpose depends on the context, but it typically helps identify you and gather the details needed for the next steps.",
    "how long will this take": "Most forms take between 5-15 minutes to complete, depending on how familiar you are with the requested information. Having your personal documents ready can make the process faster.",
    "is this information secure": "This information should be transmitted securely. Look for https in the URL and a padlock icon in your browser to confirm. The organization's privacy policy should explain how your data will be used and protected.",
    "can i save and continue later": "Many forms allow you to save your progress and continue later, but this depends on the specific website. Look for a 'Save' button or similar option. If you don't see one, you may need to complete the form in one session.",
    "why do they need": "The information requested is typically necessary to process your application, verify your identity, or provide the service you're requesting. If you're concerned about a specific field, check the form's instructions or the organization's privacy policy.",
    "what if i make a mistake": "Most forms allow you to review your information before final submission. After submitting, you may need to contact the organization directly to correct any errors.",
    "required fields": "Fields marked with an asterisk (*) or labeled as 'required' must be completed to submit the form. You cannot proceed without filling these in.",
    "what happens after i submit": "After submission, your information will be processed according to the organization's procedures. You may receive a confirmation email or message, and further instructions on next steps if applicable.",
    "why isn't the form submitting": "If you can't submit the form, check for error messages highlighting missing or incorrectly formatted information. Ensure all required fields are completed and that you have a stable internet connection.",
    "do i need to fill out everything": "You only need to complete fields marked as required (often indicated with an asterisk *). Optional fields can be left blank, though providing more information may help process your request more efficiently."
}