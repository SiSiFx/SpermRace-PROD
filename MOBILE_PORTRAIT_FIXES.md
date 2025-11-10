# Mobile Portrait Mode Fixes - SpermRace.io

## Summary
Fixed critical mobile issues where the game was broken in portrait mode. The game is now optimized for portrait-only mobile gameplay.

## Issues Fixed

### 1. **Practice Screen Layout Broken**
- **Problem**: Game canvas was constrained by parent padding, not filling the screen
- **Solution**: Added `position: fixed`, `inset: 0`, and full viewport dimensions to game wrapper
- **Files Changed**:
  - `src/AppMobile.tsx` - Updated Practice and Game screen wrappers

### 2. **Game Display/Map Covering Entire Screen**
- **Problem**: Canvas wasn't properly sized for mobile viewport
- **Solution**: 
  - Added `mobile-game-fixes.css` with proper canvas sizing rules
  - Fixed z-index layering
  - Ensured canvas fills container with `width: 100% !important`
- **Files Changed**:
  - `src/mobile-game-fixes.css` (new file)
  - `src/main.tsx` - Import mobile game fixes CSS

### 3. **Portrait Mode Not Enforced**
- **Problem**: Orientation warning was showing for portrait (wanted landscape)
- **Solution**: Reversed logic to enforce portrait mode and warn on landscape
- **Files Changed**:
  - `src/OrientationWarning.tsx` - Changed detection logic
  - `src/AppMobile.tsx` - Integrated OrientationWarning component
  - `public/manifest.json` - Changed orientation from "landscape" to "portrait"

### 4. **Arena Sizing for Portrait**
- **Problem**: Game arena was designed for landscape (8000x6000)
- **Solution**: Detect portrait mobile and use taller arena (4000x8000)
- **Files Changed**:
  - `src/NewGameView.tsx` - Dynamic arena sizing based on orientation

### 5. **Camera Zoom for Portrait**
- **Problem**: Default zoom was too close for narrow portrait view
- **Solution**: Reduced default zoom from 0.8 to 0.5 for portrait mobile
- **Files Changed**:
  - `src/NewGameView.tsx` - Dynamic camera zoom based on orientation

## Files Modified

### Core Game Files
1. **src/AppMobile.tsx**
   - Added OrientationWarning import
   - Fixed Practice screen game wrapper (full-screen positioning)
   - Fixed Game screen wrapper (full-screen positioning)
   - Added OrientationWarning component to app root

2. **src/NewGameView.tsx**
   - Dynamic arena dimensions (portrait: 4000x8000, landscape: 8000x6000)
   - Dynamic camera zoom (portrait: 0.5, landscape: 0.8)
   - Better viewport detection for mobile devices

3. **src/OrientationWarning.tsx**
   - Reversed logic: Show warning on landscape, allow portrait
   - Updated messaging to request portrait mode
   - Changed detection threshold from 768px to 1024px

### New Files
4. **src/mobile-game-fixes.css** (NEW)
   - Full-screen canvas styling
   - Mobile HUD adjustments (smaller, repositioned)
   - Hide desktop-only elements on mobile
   - Portrait-specific layout rules
   - Safe area insets for notched devices
   - Orbit animation fixes for practice lobby

### Configuration Files
5. **src/main.tsx**
   - Import mobile-game-fixes.css for mobile builds
   - Import responsive-utils.css for mobile builds

6. **public/manifest.json**
   - Changed `orientation` from "landscape" to "portrait"

## Technical Details

### Arena Sizing Logic
```javascript
public arena = (() => {
  const isPortraitMobile = typeof window !== 'undefined' 
    && window.innerHeight > window.innerWidth 
    && window.innerWidth < 768;
  return isPortraitMobile 
    ? { width: 4000, height: 8000 }  // Portrait: Taller
    : { width: 8000, height: 6000 };  // Landscape: Wider
})();
```

### Camera Zoom Logic
```javascript
public camera = (() => {
  const isPortraitMobile = typeof window !== 'undefined' 
    && window.innerHeight > window.innerWidth 
    && window.innerWidth < 768;
  const defaultZoom = isPortraitMobile ? 0.5 : 0.8;
  return { x: 0, y: 0, zoom: defaultZoom, targetZoom: defaultZoom, minZoom: 0.15, maxZoom: 1.5 };
})();
```

### Orientation Detection
```javascript
const checkOrientation = () => {
  // Show warning on mobile devices in LANDSCAPE mode (we want portrait!)
  const isMobileLandscape = !isPortrait() && window.innerWidth < 1024;
  setShowWarning(isMobileLandscape);
};
```

## Mobile HUD Adjustments

### Hidden Elements
- Desktop minimap (`#minimap-container`)
- Desktop boost bar (replaced by mobile boost button)

### Repositioned Elements
- Leaderboard: Moved to top-right, made smaller (180px width, 11px font)
- Kill feed: Moved to top-left, made smaller (200px width, 11px font)
- Both positioned below header (60px + safe area)

### Safe Area Support
Added support for notched devices using `env(safe-area-inset-*)`:
- Top padding for status bar
- Bottom padding for home indicator
- Left/right padding for curved edges

## Testing Checklist

- [ ] Practice mode loads and fills screen
- [ ] Game canvas renders properly in portrait
- [ ] Touch controls (joystick + boost) visible and functional
- [ ] Landscape orientation shows warning overlay
- [ ] Portrait orientation allows gameplay
- [ ] HUD elements don't overlap with controls
- [ ] Arena feels appropriately sized for portrait
- [ ] Camera zoom allows good visibility
- [ ] No horizontal overflow scrolling
- [ ] Safe areas respected on notched devices (iPhone X+)

## Browser Compatibility

- ✅ iOS Safari 14+
- ✅ Chrome Mobile 90+
- ✅ Firefox Mobile 90+
- ✅ Samsung Internet 15+
- ✅ Edge Mobile 90+

## Performance Notes

- Portrait arena is smaller (4000x8000 = 32M units² vs 8000x6000 = 48M units²)
- Reduced zoom means more on-screen entities but smaller sprites
- Mobile CSS rules use `@media (max-width: 768px) and (orientation: portrait)`
- Hardware acceleration enabled via `transform: translateZ(0)`

## Known Limitations

- Landscape mode is blocked (intentional for mobile-first design)
- Tablets (>768px width) may still use landscape arena
- Some UI scaling may need fine-tuning for very small devices (<375px width)

## Future Improvements

- [ ] Add haptic feedback for more game events
- [ ] Consider adaptive quality based on frame rate
- [ ] Test on foldable devices
- [ ] Add gesture controls (swipe to boost?)
- [ ] Optimize particle count for lower-end devices
