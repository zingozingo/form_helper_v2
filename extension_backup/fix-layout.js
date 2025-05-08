// Simple fix for panel layout
document.addEventListener('DOMContentLoaded', function() {
    console.log('Layout fix: DOM content loaded');
    applyLayoutFix();
});

// Also try on window load in case DOMContentLoaded already fired
window.onload = function() {
    console.log('Layout fix: Window loaded');
    applyLayoutFix();
};

// Apply immediately as well
setTimeout(applyLayoutFix, 0);

// Apply again after a short delay to ensure styles apply correctly
setTimeout(applyLayoutFix, 500);

function applyLayoutFix() {
    console.log('Applying layout fix');
    
    // Ensure basic structure is visible
    const fieldsPanel = document.getElementById('fields-panel');
    const chatPanel = document.getElementById('chat-panel');
    const panelsContainer = document.querySelector('.panels-container');
    
    if (!fieldsPanel || !chatPanel || !panelsContainer) {
        console.log('Layout fix: Missing elements, retrying in 100ms');
        setTimeout(applyLayoutFix, 100);
        return;
    }
    
    // Make sure panels container is displayed properly
    panelsContainer.style.display = 'flex';
    panelsContainer.style.flexDirection = 'row';
    panelsContainer.style.width = '100%';
    panelsContainer.style.height = '100%';
    panelsContainer.style.overflow = 'hidden';
    
    // Check if left panel should be collapsed
    const isCollapsed = fieldsPanel.classList.contains('collapsed');
    
    // Set left panel size
    if (isCollapsed) {
        fieldsPanel.style.width = '30px';
        fieldsPanel.style.minWidth = '30px';
        fieldsPanel.style.maxWidth = '30px';
    } else {
        fieldsPanel.style.width = '35%';
        fieldsPanel.style.minWidth = '280px';
        fieldsPanel.style.border = '0';
        fieldsPanel.style.borderRight = '1px solid #ddd';
        fieldsPanel.style.overflow = 'auto';
        fieldsPanel.style.overflowY = 'auto';
    }
    
    // Set right panel size
    chatPanel.style.width = '65%';
    chatPanel.style.minWidth = '350px';
    chatPanel.style.flexGrow = '1';
    chatPanel.style.height = '100%';
    chatPanel.style.display = 'flex';
    chatPanel.style.flexDirection = 'column';
    chatPanel.style.overflow = 'hidden';
    
    // Ensure chat container scrolls properly
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        chatContainer.style.flex = '1';
        chatContainer.style.overflowY = 'auto';
        chatContainer.style.display = 'flex';
        chatContainer.style.flexDirection = 'column';
        chatContainer.style.width = '100%';
    }

    // Ensure chat form is positioned correctly
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.style.width = '100%';
        chatForm.style.display = 'flex';
        chatForm.style.alignItems = 'center';
        chatForm.style.padding = '12px 16px';
        chatForm.style.borderTop = '1px solid #ddd';
    }

    // Ensure chat input takes proper width
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.style.flex = '1';
        chatInput.style.width = 'calc(100% - 100px)';
    }

    // Fix any floating blue circles - remove all duplicate buttons
    const floatingButtons = document.querySelectorAll('.toggle-fields-btn');
    if (floatingButtons.length > 1) {
        console.log(`Found ${floatingButtons.length} toggle buttons, fixing duplicates`);
        // Keep only the first toggle button, hide all others
        for (let i = 1; i < floatingButtons.length; i++) {
            if (floatingButtons[i]) {
                floatingButtons[i].style.display = 'none';
            }
        }
    }
    
    // Fix any other rogue UI elements
    const rogue = document.querySelectorAll('.toggle-fields-btn:not(#toggle-fields-btn)');
    rogue.forEach(element => {
        element.style.display = 'none';
    });
    
    // Fix fields container scrolling
    const fieldsContainer = document.getElementById('fields-container');
    if (fieldsContainer) {
        fieldsContainer.style.height = 'calc(100% - 48px)';
        fieldsContainer.style.overflowY = 'auto';
    }
    
    console.log('Layout fix applied successfully');
}