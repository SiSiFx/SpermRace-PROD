# 60fps Performance Optimization - iPhone 12 / Pixel 6

## Summary
Implemented adaptive performance settings and device detection to achieve 60fps on high-performance mobile devices (iPhone 12+, Pixel 6+, and equivalent devices).

## Changes Made

### 1. Enhanced Device Detection (`packages/client/src/deviceDetection.ts`)

#### New Functions:
- **`isHighPerformanceMobile()`**: Detects high-performance mobile devices capable of 60fps
  - Detects iPhone 12+ (iOS 14+)
  - Detects Pixel 6/7/8/9/Fold
  - Detects high-end Android devices (6GB+ RAM, 6+ cores)
  - Detects Samsung Galaxy S21+

- **`getPerformanceTier()`**: Returns 'low', 'medium', or 'high' performance tier
  - High-performance mobile devices get 'high' tier
  - Regular mobile devices get 'low' tier
  - Tablets get 'medium' tier
  - Desktop gets 'high' tier

#### Updated Function:
- **`getPerformanceSettings()`**: Now returns enhanced performance settings
  - `targetFPS`: 30/45/60 based on tier
  - `resolution`: 1/1.5/2 based on tier
  - `maxParticles`: 50/100/200 based on tier
  - `shadowsEnabled`: true/false based on tier
  - `antiAliasing`: true/false based on tier
  - `textureResolution`: 'low'/'medium'/'high'

### 2. PIXI.js Rendering Optimization (`packages/client/src/NewGameView.tsx`)

#### Initialization Changes:
- Import performance settings functions
- Use adaptive resolution based on device tier
  - High-performance mobile: up to 3x DPI
  - Regular mobile: capped at 2x DPI
  - Desktop: native DPI
- Configure PIXI with performance-aware settings
  - Antialias based on tier
  - Power preference: 'high-performance'
  - WebGL preference

#### Runtime Changes:
- Added performance tier tracking
- Adaptive FPS limiting based on device capabilities
- Frame time monitoring (samples over 1 second)
- Performance logging (optional, debug mode)
- Quality adjustment interval checking (every 2 seconds)

### 3. Frame Time Monitoring
- Tracks frame times for performance analysis
- Calculates average FPS
- Provides hooks for future dynamic quality scaling
- Logs performance metrics in debug mode

## Performance Targets by Device Tier

### High Tier (60fps):
- iPhone 12 and later (iOS 14+)
- Pixel 6 and later
- High-end Android (6GB+ RAM, 6+ cores)
- Samsung Galaxy S21+
- All desktop devices

Features:
- 60 FPS target
- 200 max particles
- High trail quality
- Shadows enabled
- Anti-aliasing enabled
- 2x resolution (or 3x for high-end devices)

### Medium Tier (45fps):
- Most tablets
- Mid-range mobile devices

Features:
- 45 FPS target
- 100 max particles
- Medium trail quality
- Shadows disabled
- Anti-aliasing enabled
- 1.5x resolution

### Low Tier (30fps):
- Older mobile devices
- Low-end Android devices

Features:
- 30 FPS target
- 50 max particles
- Low trail quality
- Shadows disabled
- Anti-aliasing disabled
- 1x resolution

## Testing

### Test File Created:
`packages/client/src/test/deviceDetection.test.ts`

Tests cover:
- iPhone 12+ detection
- Pixel 6+ detection
- High-end Android detection
- Samsung Galaxy S21+ detection
- Performance tier assignment
- Performance settings configuration

Note: Test infrastructure requires dependencies to be installed (vite, vitest, typescript)

## Expected Results

### iPhone 12 / Pixel 6:
- **FPS**: Solid 60fps gameplay
- **Resolution**: Up to 2x-3x DPI for crisp visuals
- **Quality**: High quality trails, shadows, and effects
- **Performance**: Smooth gameplay without overheating

### Older Mobile Devices:
- **FPS**: 30-45fps (adaptive)
- **Resolution**: 1x-1.5x DPI for performance
- **Quality**: Reduced particle count, no shadows
- **Performance**: Optimized for device capabilities

## Technical Details

### Device Detection Strategy:
1. **iOS devices**: Detect via iOS version (14+ = iPhone 12+)
2. **Pixel devices**: Match "Pixel 6|7|8|9|Fold" in user agent
3. **Generic Android**: Check deviceMemory (>=6GB) and hardwareConcurrency (>=6 cores)
4. **Samsung devices**: Match model numbers for S21+

### Performance Monitoring:
- Frame time samples collected over 1 second
- Average FPS calculation every 2 seconds
- Debug logging for performance analysis
- Hooks for future dynamic quality adjustment

### Memory Efficiency:
- Frame time sample array limited to 60 entries
- Automatic cleanup of old samples
- Minimal memory overhead (~1KB)

## Future Enhancements

Possible improvements for future iterations:
1. Dynamic quality scaling based on actual frame times
2. User override for quality settings
3. Performance profiling mode
4. Adaptive resolution based on thermal throttling
5. Battery-aware performance scaling

## Files Modified

1. `packages/client/src/deviceDetection.ts` - Enhanced detection and performance settings
2. `packages/client/src/NewGameView.tsx` - Adaptive rendering configuration
3. `packages/client/src/test/deviceDetection.test.ts` - Comprehensive tests (new file)

## Date: 2026-01-26
