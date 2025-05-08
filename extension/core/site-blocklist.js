/**
 * Site Blocklist - Prevents Form Helper activation on non-form websites
 * 
 * This module provides strict domain blocking for sites where Form Helper
 * should never activate by default.
 */

const SiteBlocklist = {
  /**
   * Major social media platforms
   */
  SOCIAL_MEDIA: [
    "instagram.com",
    "twitter.com",
    "x.com", 
    "facebook.com",
    "linkedin.com",
    "tiktok.com",
    "snapchat.com",
    "pinterest.com",
    "reddit.com",
    "tumblr.com",
    "vk.com",
    "weibo.com",
    "discord.com",
    "telegram.org",
    "whatsapp.com"
  ],
  
  /**
   * Video and streaming platforms
   */
  VIDEO_PLATFORMS: [
    "youtube.com",
    "vimeo.com",
    "twitch.tv",
    "netflix.com",
    "hulu.com",
    "disney.com",
    "disneyplus.com",
    "hbomax.com",
    "peacocktv.com",
    "primevideo.com",
    "dailymotion.com"
  ],
  
  /**
   * News and content sites
   */
  NEWS_SITES: [
    "nytimes.com",
    "washingtonpost.com",
    "cnn.com",
    "bbc.com",
    "theguardian.com",
    "huffpost.com",
    "foxnews.com",
    "nbcnews.com",
    "bloomberg.com",
    "wsj.com",
    "reuters.com",
    "apnews.com",
    "aljazeera.com",
    "medium.com"
  ],
  
  /**
   * Online shopping platforms
   */
  SHOPPING_SITES: [
    "amazon.com",
    "walmart.com",
    "ebay.com",
    "etsy.com",
    "target.com",
    "bestbuy.com",
    "alibaba.com",
    "aliexpress.com",
    "wayfair.com"
  ],
  
  /**
   * Productivity and document sites
   */
  PRODUCTIVITY_SITES: [
    "docs.google.com",
    "sheets.google.com", 
    "slides.google.com",
    "drive.google.com",
    "calendar.google.com",
    "office.com",
    "office365.com",
    "microsoft365.com",
    "onedrive.live.com",
    "sharepoint.com",
    "onenote.com",
    "evernote.com",
    "notion.so",
    "trello.com",
    "asana.com",
    "monday.com",
    "airtable.com",
    "slack.com",
    "teams.microsoft.com",
    "zoom.us",
    "meet.google.com",
    "webex.com"
  ],
  
  /**
   * Email providers
   */
  EMAIL_PROVIDERS: [
    "gmail.com",
    "mail.google.com",
    "outlook.com",
    "live.com",
    "hotmail.com",
    "yahoo.com/mail",
    "mail.yahoo.com",
    "protonmail.com",
    "mail.proton.me",
    "aol.com",
    "mail.aol.com",
    "icloud.com"
  ],
  
  /**
   * Gaming platforms
   */
  GAMING_PLATFORMS: [
    "twitch.tv",
    "steam.com",
    "steampowered.com",
    "epicgames.com",
    "ea.com",
    "origin.com",
    "battlenet.com",
    "blizzard.com",
    "ubisoft.com",
    "uplay.com",
    "playstation.com",
    "xbox.com",
    "nintendo.com",
    "roblox.com",
    "minecraft.net"
  ],
  
  /**
   * Other popular sites without significant forms
   */
  OTHER_SITES: [
    "wikipedia.org",
    "wikimedia.org",
    "github.com",
    "stackoverflow.com",
    "quora.com",
    "yelp.com",
    "tripadvisor.com",
    "booking.com",
    "expedia.com",
    "kayak.com",
    "spotify.com",
    "apple.com/music",
    "deezer.com",
    "pandora.com",
    "soundcloud.com",
    "weather.com",
    "accuweather.com"
  ],
  
  /**
   * Specific paths within domains that should be blocked
   * Format: { domain: string, paths: string[] }
   */
  BLOCKED_PATHS: [
    { domain: "github.com", paths: ["/trending", "/marketplace", "/explore"] },
    { domain: "reddit.com", paths: ["/r/", "/user/"] },
    { domain: "youtube.com", paths: ["/watch", "/playlist", "/channel", "/c/", "/results"] },
    { domain: "amazon.com", paths: ["/gp/video", "/store", "/s"] },
    { domain: "google.com", paths: ["/maps", "/search", "/news"] }
  ],
  
  /**
   * Explicit exceptions - sites that would otherwise be blocked 
   * but actually have legitimate forms to help with
   * Format: { domain: string, paths: string[] }
   */
  EXCEPTIONS: [
    // Login pages for otherwise blocked sites
    { domain: "twitter.com", paths: ["/i/flow/login", "/i/flow/signup"] },
    { domain: "facebook.com", paths: ["/login", "/reg"] },
    { domain: "instagram.com", paths: ["/accounts/login", "/accounts/emailsignup"] },
    { domain: "linkedin.com", paths: ["/login", "/signup"] },
    { domain: "github.com", paths: ["/login", "/join"] },
    
    // Form-specific subdomains
    { domain: "forms.office.com", paths: [""] },
    { domain: "docs.google.com", paths: ["/forms"] }
  ],
  
  /**
   * Known form sites that should always be allowed
   */
  ALLOWED_FORM_SITES: [
    "forms.gle",
    "forms.office.com",
    "formstack.com",
    "form.jotform.com",
    "surveymonkey.com",
    "typeform.com",
    "wufoo.com",
    "formsite.com",
    "cognito.forms.com",
    "kwiksurveys.com",
    "qualtrics.com",
    "formassembly.com"
  ],
  
  /**
   * Get the full blocklist combining all categories
   * @returns {string[]} Complete list of blocked domains
   */
  getAllBlockedDomains() {
    return [
      ...this.SOCIAL_MEDIA,
      ...this.VIDEO_PLATFORMS,
      ...this.NEWS_SITES,
      ...this.SHOPPING_SITES,
      ...this.PRODUCTIVITY_SITES,
      ...this.EMAIL_PROVIDERS,
      ...this.GAMING_PLATFORMS,
      ...this.OTHER_SITES
    ];
  },
  
  /**
   * Get the full exceptions list
   * @returns {string[]} Complete list of allowed domains
   */
  getAllAllowedDomains() {
    return this.ALLOWED_FORM_SITES;
  },
  
  /**
   * Checks if the current site is in the blocklist
   * @param {string} [url] - URL to check, defaults to current location
   * @returns {boolean} True if site should be blocked
   */
  isSiteBlocked(url) {
    const currentUrl = url || window.location.href;
    const hostname = new URL(currentUrl).hostname.toLowerCase();
    const pathname = new URL(currentUrl).pathname.toLowerCase();
    
    // First check if this is a known allowed form site
    for (const allowedDomain of this.ALLOWED_FORM_SITES) {
      if (hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`)) {
        console.log(`🛡️ Site Blocklist: Site explicitly allowed as form site: ${hostname}`);
        return false;
      }
    }
    
    // Check if this is an exception (a specific path on an otherwise blocked domain)
    for (const exception of this.EXCEPTIONS) {
      if (hostname === exception.domain || hostname.endsWith(`.${exception.domain}`)) {
        // For empty path array, the entire domain is an exception
        if (exception.paths.length === 0 || exception.paths[0] === "") {
          console.log(`🛡️ Site Blocklist: Site found in global exceptions: ${hostname}`);
          return false;
        }
        
        // Check if current path starts with any of the exception paths
        for (const path of exception.paths) {
          if (pathname.startsWith(path)) {
            console.log(`🛡️ Site Blocklist: Path found in exceptions: ${hostname}${pathname}`);
            return false;
          }
        }
      }
    }
    
    // Check against master blocklist
    for (const blockedDomain of this.getAllBlockedDomains()) {
      if (hostname === blockedDomain || hostname.endsWith(`.${blockedDomain}`)) {
        console.log(`🛡️ Site Blocklist: Site blocked by domain list: ${hostname}`);
        return true;
      }
    }
    
    // Check for blocked paths on specific domains
    for (const blockedPath of this.BLOCKED_PATHS) {
      if (hostname === blockedPath.domain || hostname.endsWith(`.${blockedPath.domain}`)) {
        for (const path of blockedPath.paths) {
          if (pathname.startsWith(path)) {
            console.log(`🛡️ Site Blocklist: Path blocked: ${hostname}${pathname}`);
            return true;
          }
        }
      }
    }
    
    // Not in blocklist
    return false;
  },
  
  /**
   * Detailed check with report for why a site is blocked or allowed
   * @param {string} [url] - URL to check, defaults to current location
   * @returns {Object} Detailed report with blocked status and reason
   */
  checkSiteWithReport(url) {
    const currentUrl = url || window.location.href;
    const hostname = new URL(currentUrl).hostname.toLowerCase();
    const pathname = new URL(currentUrl).pathname.toLowerCase();
    
    // Report object to return
    const report = {
      url: currentUrl,
      hostname: hostname,
      pathname: pathname,
      isBlocked: false,
      reason: '',
      category: '',
      details: {}
    };
    
    // Check if this is a known allowed form site
    for (const allowedDomain of this.ALLOWED_FORM_SITES) {
      if (hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`)) {
        report.isBlocked = false;
        report.reason = `Site explicitly allowed as dedicated form platform`;
        report.category = 'ALLOWED_FORM_SITES';
        return report;
      }
    }
    
    // Check if this is an exception path
    for (const exception of this.EXCEPTIONS) {
      if (hostname === exception.domain || hostname.endsWith(`.${exception.domain}`)) {
        // For empty path array, the entire domain is an exception
        if (exception.paths.length === 0 || exception.paths[0] === "") {
          report.isBlocked = false;
          report.reason = `Site is in global exceptions list`;
          report.category = 'EXCEPTIONS';
          report.details = { exception };
          return report;
        }
        
        // Check if current path starts with any of the exception paths
        for (const path of exception.paths) {
          if (pathname.startsWith(path)) {
            report.isBlocked = false;
            report.reason = `Path is in exceptions list for this domain`;
            report.category = 'EXCEPTIONS';
            report.details = { exception, matchedPath: path };
            return report;
          }
        }
      }
    }
    
    // Check against each category in blocklist
    const categories = [
      'SOCIAL_MEDIA', 'VIDEO_PLATFORMS', 'NEWS_SITES', 'SHOPPING_SITES', 
      'PRODUCTIVITY_SITES', 'EMAIL_PROVIDERS', 'GAMING_PLATFORMS', 'OTHER_SITES'
    ];
    
    for (const category of categories) {
      for (const blockedDomain of this[category]) {
        if (hostname === blockedDomain || hostname.endsWith(`.${blockedDomain}`)) {
          report.isBlocked = true;
          report.reason = `Site blocked by ${category.toLowerCase().replace('_', ' ')} blocklist`;
          report.category = category;
          report.details = { blockedDomain };
          return report;
        }
      }
    }
    
    // Check for blocked paths on specific domains
    for (const blockedPath of this.BLOCKED_PATHS) {
      if (hostname === blockedPath.domain || hostname.endsWith(`.${blockedPath.domain}`)) {
        for (const path of blockedPath.paths) {
          if (pathname.startsWith(path)) {
            report.isBlocked = true;
            report.reason = `Specific path blocked for this domain`;
            report.category = 'BLOCKED_PATHS';
            report.details = { blockedPath, matchedPath: path };
            return report;
          }
        }
      }
    }
    
    // Not in blocklist
    report.isBlocked = false;
    report.reason = 'Site not found in any blocklist';
    return report;
  }
};

// Export as a global object
window.SiteBlocklist = SiteBlocklist;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SiteBlocklist;
}