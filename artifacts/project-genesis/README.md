# Project Genesis Online - E2E Tests

Touch regression tests for Project Genesis Online using Playwright.

## Setup

```bash
pnpm install
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run with UI
pnpm test:ui

# Run in headed mode
pnpm test:headed
```

## Test Coverage

### touch-regression.spec.ts

1. **Joystick touch with pointerup and pointercancel**
   - Verifies hub-play button click to start game
   - Tests joystick pointerup event handling
   - Tests joystick pointercancel event handling

2. **Combat, navigation and panel open/close**
   - Verifies hub-play button click and faction selection
   - Tests left/right navigation
   - Tests panel open and close functionality
   - Tests combat interactions

## Mobile Devices Tested

- **Chromium Mobile**: Pixel 5 ✓ (2/2 tests passing - 3.1s)
- **WebKit Mobile**: iPad Pro ✓ (2/2 tests passing - 3.9s)
- **Total**: 4/4 tests passing (5.3s combined execution)

## Key Fixes

- Changed selector from `button-start-game` to `button-hub-play` for game start
- Added proper waits for game screen rendering
- Implemented faction selection before gameplay
- Added comprehensive touch event testing for mobile devices
