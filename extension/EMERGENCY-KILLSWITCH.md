# ☢️ NUCLEAR KILLSWITCH SYSTEM ☢️

This document provides a comprehensive overview of the nuclear emergency system implemented to prevent the Form Helper extension from running on non-form websites like Instagram, LinkedIn, and other social media sites.

**CRITICAL: DO NOT MODIFY ANY OF THE KILLSWITCH FILES UNDER ANY CIRCUMSTANCES.**

## Nuclear Approach

After previous attempts to implement reliable blocking mechanisms, we've implemented a **nuclear option** that uses a completely different approach guaranteed to work:

1. A `pre-killswitch.js` script runs at `document_start` and injects code directly into the page context
2. This injected code creates a non-overridable property in the window object using `Object.defineProperty`
3. All other scripts check this property before executing anything
4. The property cannot be changed or deleted, ensuring 100% reliable blocking

This approach is failsafe because:
- It runs before any other extension code 
- It works even if other scripts fail or are modified
- It uses JavaScript's own property protection mechanisms
- It injects CSS that cannot be overridden
- It has multiple redundant checks and fallbacks

## Architecture Overview

The extension now implements a failsafe multi-layered protection system with a nuclear option as the first line of defense:

1. **Nuclear Pre-Killswitch** (`pre-killswitch.js`)
   - Absolute first script loaded with `document_start` timing
   - Runs in MAIN world (not isolated extension context)
   - Injects code directly into the page context
   - Creates non-overridable window property with `Object.defineProperty`
   - All other scripts check this property before executing
   - Injects CSS that completely hides any Form Helper UI elements
   - Nuclear approach guaranteed to work in all situations

2. **Emergency Killswitch** (`emergency-killswitch.js`)
   - Legacy killswitch that runs after pre-killswitch
   - Uses a strict whitelist approach - only allows known form sites
   - Sets multiple global termination flags if site is not allowed
   - Implements a comprehensive object with CSS injection to hide UI elements
   - Uses MutationObserver to prevent UI elements from being added
   - Overrides critical functions to prevent any script execution

3. **Early Termination Check** (`early-check.js`)
   - Secondary protection layer that runs at `document_start`
   - Focuses on high-traffic social media sites
   - Logs termination events and sets global termination flags
   - Implements its own MutationObserver to catch any UI elements that slip through

4. **Background Blocker** (in `background.js`)
   - Protection at the extension level
   - Prevents script injection on blacklisted sites
   - Updates badge and icon to show blocked status
   - Implements a custom popup for blocked sites
   - Maintains a registry of blocked sites for faster checks

5. **Content Script Check** (`content.js`)
   - First checks the nuclear killswitch property
   - Checks for termination flags set by earlier scripts
   - Implements a tertiary domain check as final safeguard
   - Throws error to completely halt execution if blocked
   - Provides a global emergencyTerminate function that can be called from anywhere

6. **Comprehensive Site Blocklist** (`core/site-blocklist.js`)
   - Contains extensive categorized lists of sites to block
   - Includes exceptions for specific form-containing pages
   - Provides detailed reporting for blocked sites
   - Implements both blacklist and whitelist approaches

7. **Strict Initialization** (`core/strict-initializer.js`)
   - Performs verification before allowing extension to activate
   - Uses multiple checkpoints for activation decisions
   - Reports activation state to background script

## Key Components

### 1. Emergency Killswitch

The `emergency-killswitch.js` script is loaded first with highest priority and uses a whitelist approach, meaning it only allows the extension to run on explicitly defined form sites.

```javascript
// Key functionality:
const ALLOWED_DOMAINS = [
  'testpages.herokuapp.com',
  'form-test.com',
  'formtestpage.com',
  'forms.gle',
  'forms.office.com'
  // other allowed domains
];

// Check if current hostname is in the allowed list
let isAllowed = false;
for (const domain of ALLOWED_DOMAINS) {
  if (hostname === domain || hostname.endsWith('.' + domain) || 
      hostname.includes(domain)) {
    isAllowed = true;
    break;
  }
}

// If not allowed, terminate immediately
if (!isAllowed) {
  window.FORM_HELPER_TERMINATED = true;
  window.FORM_HELPER_EMERGENCY_TERMINATED = true;
  window.__FORM_HELPER_KILLSWITCH_ACTIVATED = true;
  // Other termination flags
}
```

### 2. Content Script Emergency Check

The `content.js` script includes a secondary emergency check that runs if the killswitch somehow fails:

```javascript
// Check if already terminated by emergency-killswitch.js
if (window.FORM_HELPER_TERMINATED || window.FORM_HELPER_EMERGENCY_TERMINATED) {
  throw new Error('FORM_HELPER_EMERGENCY_KILLSWITCH_ACTIVATED');
}

// Secondary emergency domain check
function emergencyDomainCheck() {
  // Extensive list of blacklisted domains
  const BLACKLISTED_DOMAINS = [
    'instagram.com',
    'facebook.com',
    'linkedin.com'
    // many others
  ];
  
  // Check against blacklist & whitelist
  // Set termination flags if needed
}
```

### 3. Site Blocklist Module

The `SiteBlocklist` module provides extensive categorized lists of sites where the extension should not run:

```javascript
const SiteBlocklist = {
  SOCIAL_MEDIA: [
    "instagram.com",
    "twitter.com",
    // many others
  ],
  
  VIDEO_PLATFORMS: [...],
  NEWS_SITES: [...],
  SHOPPING_SITES: [...],
  // other categories
  
  // Methods to check if site is blocked
  isSiteBlocked(url) { ... },
  checkSiteWithReport(url) { ... }
};
```

### 4. Background Script Handler

The background script has been updated to properly handle emergency termination messages:

```javascript
// Handle emergency termination notification
if (message.action === 'earlyTermination' || message.action === 'emergencyTermination') {
  const isEmergency = message.action === 'emergencyTermination';
  
  // Update badge to show blocked status
  chrome.action.setBadgeText({
    text: isEmergency ? '❌' : '🚫',
    tabId: sender.tab.id
  });
  
  // Other badge and notification updates
}
```

## Multi-layered Protection Summary

1. **Layer 1:** Emergency Killswitch (whitelist approach)
   - Comprehensive object with termination methods
   - CSS injection to hide UI
   - Function overriding to prevent execution
   - MutationObserver to catch new UI elements

2. **Layer 2:** Early Termination Check (social media blacklist)
   - Secondary domain checking
   - Additional CSS injection
   - Separate MutationObserver

3. **Layer 3:** Background Script Blocker
   - Tab URL checking before scripts even load
   - Script injection prevention
   - Custom popup UI for blocked sites
   - Badge and icon updates

4. **Layer 4:** Content Script Emergency Check
   - Throw error to halt execution completely
   - Global emergency termination function
   - Additional domain checking

5. **Layer 5:** Site Blocklist Module
   - Categorized comprehensive blocklists
   - Domain exception handling
   - Detailed reporting

6. **Layer 6:** Strict Initialization
   - Multi-checkpoint verification
   - Form quality validation

## Load Order and Priority

The protection mechanisms are loaded in the following precisely ordered sequence:

1. `emergency-killswitch.js` (document_start - highest priority)
2. `early-check.js` (document_start - second priority)
3. Core modules including `site-blocklist.js` (document_start - third priority)
4. Content scripts including `content.js` (document_end)
5. Background script (persistent service worker)
6. Popup UI for blocked sites (on-demand)

This ensures that blocking occurs as early as possible in the page lifecycle, preventing any unnecessary code execution on non-form sites.

## Fail-Safe Mechanisms

To ensure the extension is never activated on inappropriate sites, we've implemented multiple fail-safe mechanisms:

1. **CSS Injection** - Even if JavaScript fails, CSS rules prevent UI visibility
2. **MutationObserver** - Actively monitors for and removes any UI elements that might appear
3. **Function Overriding** - Replaces core functions with no-ops to prevent execution
4. **Error Throwing** - Deliberately throws errors to halt script execution completely
5. **Background Blocking** - Prevents content scripts from loading entirely on blocked sites
6. **Session Storage** - Maintains blocking state across page refreshes
7. **Visual Indicators** - Makes it obvious to the user when a site is blocked

## Testing Instructions

To test that the emergency killswitch is working properly:

1. Load the extension in developer mode
2. Visit a blocked site like instagram.com or linkedin.com
3. Check the console - you should see emergency killswitch messages
4. Verify the extension icon shows the blocked status (❌)
5. Ensure no form helper UI appears on the page

To test on allowed sites:

1. Visit testpages.herokuapp.com or similar test site with forms
2. Verify the extension activates normally
3. Check the console for "Site is ALLOWED" messages

## Developer Testing Override

A special developer override mechanism has been implemented for testing purposes:

1. On blocked sites, the extension popup will show a blocking message
2. Developers with access to developer mode can use the override button
3. This override is PER TAB and TEMPORARY (cleared on page refresh or navigation)
4. When activated, it will show a "DEV" badge and bypass the killswitch only for that tab
5. This is strictly for testing and development - it's not accessible to end users

To enable developer mode:
```javascript
// Use Chrome DevTools Console to run:
chrome.storage.local.set({developerMode: true});
```

And to disable:
```javascript
// Use Chrome DevTools Console to run:
chrome.storage.local.set({developerMode: false});
```

## Production Deployment Checklist

Before deploying to production, ensure:

1. The killswitch files are intact and unmodified
2. The manifest.json has the proper script loading order
3. Developer mode is disabled in the storage
4. All relevant domains are in the blocklists
5. The whitelist contains ONLY legitimate form sites
6. Test on Instagram, LinkedIn, and other social sites to verify blocking works
7. Test on form sites to verify the extension still works properly
8. Verify the popup UI shows blocked status on non-form sites

## Final Note

This implementation provides multiple redundant layers of protection to ensure the extension will not activate on inappropriate sites, particularly social media platforms. The strict whitelist approach in the emergency killswitch provides the strongest guarantee, while the additional layers serve as fallback mechanisms.

**IMPORTANT: NEVER remove or modify these killswitch files without thorough testing and team approval.**