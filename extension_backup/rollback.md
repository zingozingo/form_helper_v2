# Layout Fix Instructions

If you're experiencing issues with the panel layout, please try the following steps:

## Option 1: Use the minimal panel

I've created a minimal panel version that uses simpler CSS and has a basic two-panel layout. To use it:

1. Open the extension folder
2. Rename `panel.html` to `panel-original.html` 
3. Rename `panel-minimal.html` to `panel.html`
4. Restart the extension

## Option 2: Restore original CSS

If you prefer to keep the original functionality but just fix the layout:

1. Edit `styles.css`
2. Replace the `.panels-container` section with:
```css
.panels-container {
  display: flex;
  flex-direction: row;
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
```

3. Remove the `height: calc(100vh - 45px)` from the `.main` selector

## Option 3: Use the reset CSS

The `reset.css` file contains simplified baseline styles. You can:

1. Edit `panel.html`
2. Make sure it has both stylesheets in this order:
```html
<link rel="stylesheet" href="reset.css">
<link rel="stylesheet" href="styles.css">
```

## If you still have issues

Try removing the `fix-layout.js` script reference from `panel.html` if it's causing problems.