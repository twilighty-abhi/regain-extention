# Website Blocker Chrome Extension

A modern, Material UI-styled Chrome extension for blocking websites with support for wildcard patterns and intuitive management.

## Features

### 🚫 Website Blocking
- Block specific websites by domain
- Support for wildcard patterns (e.g., `*.facebook.com`)
- Real-time blocking with beautiful overlay messages
- Toggle blocking on/off instantly

### 🎨 Material UI Design
- Clean, modern Android-style interface
- Smooth animations and transitions
- Responsive design for all screen sizes
- Professional Material Icons throughout

### ⚙️ Advanced Settings
- Comprehensive options page
- Quick-add functionality from popup
- Bulk import/export of blocked sites
- Preset categories (Social Media, News, Entertainment)

### 📱 User Experience
- Beautiful blocked page with blurred background
- Toast notifications for user feedback
- Intuitive toggle switches
- Quick access from browser toolbar

## Installation

### Method 1: Developer Mode (Recommended)

1. **Download the Extension**
   - Clone or download this repository
   - Extract if downloaded as ZIP

2. **Enable Developer Mode**
   - Open Chrome/Edge and go to `chrome://extensions/`
   - Toggle "Developer mode" in the top right

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the extension folder
   - The extension should now appear in your browser toolbar

### Method 2: Create Icons (Optional)

The extension includes a basic SVG icon. For better appearance:

1. Convert `icons/icon.svg` to PNG files:
   - `icon16.png` (16x16)
   - `icon32.png` (32x32) 
   - `icon48.png` (48x48)
   - `icon128.png` (128x128)

2. Replace the SVG references in `manifest.json` if needed

## Usage

### Basic Usage

1. **Click the Extension Icon**
   - View currently blocked sites
   - Toggle blocking on/off
   - Quick-add new sites

2. **Block a Website**
   - Enter URL in the input field
   - Supports patterns like:
     - `facebook.com`
     - `*.social-media.com`
     - `https://example.com`

3. **Manage Sites**
   - Click settings icon for advanced options
   - Enable/disable individual sites
   - Remove sites from the list

### Advanced Features

#### Wildcard Patterns
- `*.example.com` - Blocks all subdomains
- `example.*` - Blocks all TLDs
- `social-media.com` - Blocks exact domain

#### Preset Categories
- **Social Media**: Facebook, Instagram, Twitter, etc.
- **News Sites**: CNN, BBC, Reuters, etc.
- **Entertainment**: YouTube, Netflix, Twitch, etc.

#### Import/Export
- Export your settings as JSON backup
- Import settings from backup file
- Share configurations between devices

## File Structure

```
regain-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── options.html          # Settings page
├── options.css           # Settings styling
├── options.js            # Settings functionality
├── background.js         # Service worker
├── content.js            # Content script
├── content.css           # Content script styles
├── blocked.html          # Blocked page redirect
├── rules.json            # Declarative rules (empty)
├── icons/                # Extension icons
│   └── icon.svg         # Base icon
└── README.md            # This file
```

## Permissions Explained

The extension requires these permissions:

- **storage**: Save your blocked sites and settings
- **activeTab**: Check if current tab should be blocked
- **tabs**: Monitor navigation for blocking
- **declarativeNetRequest**: Block requests efficiently
- **host_permissions**: Access all websites for blocking

## Customization

### Modify Presets
Edit the `presets` object in `options.js` to add custom categories:

```javascript
const presets = {
  work: ['slack.com', 'teams.microsoft.com'],
  gaming: ['steam.com', 'epicgames.com']
};
```

### Change Colors
Modify the CSS color variables in the `.css` files:
- Primary: `#1976d2` (Blue)
- Success: `#388e3c` (Green)  
- Error: `#d32f2f` (Red)

### Add Custom Blocking Logic
Extend the `checkIfBlocked()` function in `background.js` for custom rules.

## Browser Compatibility

- ✅ Chrome (Manifest V3)
- ✅ Microsoft Edge (Chromium)
- ✅ Brave Browser
- ✅ Other Chromium-based browsers

## Troubleshooting

### Extension Not Working
1. Check if extension is enabled in `chrome://extensions/`
2. Reload the extension after making changes
3. Check browser console for errors

### Sites Not Blocking
1. Verify the URL pattern is correct
2. Check if blocking is enabled (toggle switch)
3. Try refreshing the page

### Performance Issues
1. Limit blocked sites to reasonable number (<100)
2. Use specific patterns instead of broad wildcards
3. Disable and re-enable if needed

## Development

### Making Changes
1. Edit the relevant files
2. Go to `chrome://extensions/`
3. Click refresh icon on the extension
4. Test your changes

### Adding Features
- **New UI Elements**: Modify HTML/CSS files
- **New Functionality**: Edit JavaScript files  
- **New Permissions**: Update `manifest.json`

## Privacy

This extension:
- ✅ Stores data locally only
- ✅ No data sent to external servers
- ✅ No tracking or analytics
- ✅ Open source and transparent

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Verify browser compatibility
3. Review browser console for errors
4. Ensure all files are present

## License

This project is open source. Feel free to modify and distribute according to your needs.

---

**Made with ❤️ and Material Design principles** 