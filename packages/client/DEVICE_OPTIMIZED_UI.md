# Device-Optimized UI Implementation

## Overview

The SpermRace.io client now features **separate optimized UI implementations** for PC and mobile devices, automatically detecting the user's device and loading the appropriate experience.

## Architecture

### Device Detection
- **File**: `src/deviceDetection.ts`
- Automatically detects if user is on mobile (phone), tablet, or desktop
- Uses user agent + screen size + touch capability for accurate detection
- Provides performance settings based on device type

### Dual UI Systems

#### 1. PC-Optimized UI (`AppPC.tsx`)
**Features**:
- 🖱️ Mouse-optimized controls and hover states
- ⌨️ Keyboard shortcuts (ESC, P, T)
- 🖥️ Larger, more detailed UI components
- 📊 Expanded stats and information displays
- 🎨 Desktop-first design with gradients and animations
- 🐛 Debug panel for development

**Key Components**:
- Keyboard shortcuts hint in bottom-left
- Larger tournament cards with detailed info
- Desktop-sized modals and containers
- PC-specific styling for all screens

#### 2. Mobile-Optimized UI (`AppMobile.tsx`)
**Features**:
- 👆 Touch-first controls with larger hit targets
- 📱 Compact, vertical layouts
- 🔄 Swipe gestures and touch feedback
- 💪 Optimized for one-handed use
- 🚀 Faster loading with mobile-specific styles
- ⚡ Performance optimizations

**Key Components**:
- Mobile-specific navigation
- Compact stat cards
- Full-screen modals
- Touch-optimized buttons (min 44px height)
- Safe area support for notched devices

### Entry Point (`main.tsx`)
```typescript
// Detects device
const isMobile = isMobileDevice();

// Loads appropriate UI + styles
if (isMobile) {
  import('./styles-mobile.css');
  import('./AppMobile');
} else {
  import('./styles-pc.css');
  import('./AppPC');
}
```

## File Structure

```
src/
├── main.tsx                 # Entry point with device detection
├── deviceDetection.ts       # Device detection utilities
├── AppPC.tsx               # PC-optimized components
├── AppMobile.tsx           # Mobile-optimized components
├── styles-pc.css           # PC-specific styles
├── styles-mobile.css       # Mobile-specific styles
└── [shared components]     # WalletProvider, WsProvider, NewGameView, etc.
```

## Testing

### Test on PC
1. Open http://93.180.133.94:5174/ in desktop browser
2. Should see PC UI with:
   - Keyboard shortcuts hint (bottom-left)
   - Desktop badge "🖥️ PC EDITION"
   - Larger buttons and layouts
   - Hover effects on cards

### Test on Mobile
1. Open http://93.180.133.94:5174/ on smartphone
2. Should see Mobile UI with:
   - Mobile indicator "📱" (top-left)
   - Compact vertical layout
   - Larger touch targets
   - No hover effects, tap feedback instead

### Test Device Detection
Open browser DevTools:

**Chrome/Edge**:
1. Press F12
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device (iPhone, iPad, etc.)
4. Refresh page

**Firefox**:
1. Press F12
2. Click "Responsive Design Mode" 
3. Select device preset
4. Refresh page

## Performance Settings by Device

```typescript
// Mobile
{
  maxParticles: 50,
  trailQuality: 'low',
  shadowsEnabled: false,
  antiAliasing: false,
  targetFPS: 30
}

// Tablet
{
  maxParticles: 100,
  trailQuality: 'medium',
  shadowsEnabled: false,
  antiAliasing: true,
  targetFPS: 45
}

// Desktop
{
  maxParticles: 200,
  trailQuality: 'high',
  shadowsEnabled: true,
  antiAliasing: true,
  targetFPS: 60
}
```

## Key Differences

### PC UI
- Keyboard shortcuts visible
- Debug panel (dev mode)
- Detailed tournament cards
- Multi-column layouts
- Larger text and spacing
- Hover animations
- 600-1400px max widths

### Mobile UI
- Touch-optimized controls
- Single-column layouts
- Compact cards and stats
- Tap feedback (scale effects)
- Safe area insets for notches
- Bottom sheet modals
- 90% width containers

## Shared Features
Both UIs share:
- Same backend connection (WsProvider)
- Same wallet integration (WalletProvider)
- Same game engine (NewGameView)
- Same state management
- Same tournament/lobby logic

## Hot Reload

Changes to any of these files will hot-reload on the dev server:
- `AppPC.tsx` → PC users see changes
- `AppMobile.tsx` → Mobile users see changes
- `styles-pc.css` → PC styles update
- `styles-mobile.css` → Mobile styles update
- `deviceDetection.ts` → Affects both

## Future Enhancements

### Planned
- [ ] Tablet-specific UI (hybrid of PC/mobile)
- [ ] User preference override (force PC/mobile mode)
- [ ] Orientation-specific layouts
- [ ] PWA optimizations for mobile
- [ ] Native mobile gestures (pinch, swipe)

### Performance
- [ ] Lazy load heavy components
- [ ] Image optimization per device
- [ ] Adaptive quality settings
- [ ] Connection-aware features (3G vs WiFi)

## Troubleshooting

### Wrong UI Loading?
1. Check `deviceDetection.ts` logic
2. Verify screen size < 768px for mobile
3. Check user agent in DevTools

### Styles Not Applying?
1. Ensure correct CSS file imported
2. Check class names match (`.pc-*` vs `.mobile-*`)
3. Clear browser cache

### Hot Reload Not Working?
1. Check Vite dev server is running
2. Verify file watching is enabled
3. Try hard refresh (Ctrl+Shift+R)

## Development Tips

1. **Test Both UIs**: Always test changes on both PC and mobile
2. **Use DevTools**: Toggle device mode frequently
3. **Touch Targets**: Mobile buttons should be min 44px height
4. **Performance**: Mobile gets lighter styles and fewer effects
5. **Safe Areas**: Use `env(safe-area-inset-*)` for notched devices

## Build & Deploy

Development:
```bash
npm run dev
# or
pnpm dev
```

Production build:
```bash
npm run build
# Outputs optimized bundle with code splitting
```

The build will automatically:
- Tree-shake unused UI components
- Code-split PC and Mobile bundles
- Only load required styles per device
- Optimize for target platforms

---

**Note**: The device detection happens once on page load. Users won't see UI changes if they resize browser window. This is intentional to avoid layout shifts and maintain consistent UX.
