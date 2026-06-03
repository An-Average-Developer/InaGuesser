// ===== DEV TOOLS =====
// Remove the <script> tag in index.html to disable this entirely.

// Set to false to hide the blue zone rectangles on the map.
const SHOW_ZONE_RECTS = false;

(function () {
    if (!SHOW_ZONE_RECTS) {
        const style = document.createElement('style');
        style.textContent = '.zone-highlight { display: none !important; }';
        document.head.appendChild(style);
    }
})();
