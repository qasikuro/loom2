---
name: iOS modal stacking — picker stall after sheet dismiss
description: On iOS, launching a system picker immediately after dismissing a Modal causes the app to silently stall
---

On iOS (Expo Go and production), if you call `ImagePicker.launchImageLibraryAsync()` or `launchCameraAsync()` immediately after `setShowSheet(false)` (which closes a Modal), the app gets stuck — the image library never opens and no error is thrown. This is because iOS requires the first modal to fully finish its dismiss animation before a new system modal can be presented.

**The fix:** add a `setTimeout` before launching the picker:

```javascript
function handleSheetLibrary() {
  setShowSheet(false);
  setTimeout(() => pickImage(), Platform.OS === 'ios' ? 400 : 50);
}
```

400ms is enough for the modal dismiss animation. On Android 50ms is fine (the issue doesn't occur there). On web the delay is harmless.

**Why:** iOS UIKit prevents presenting a new view controller while one is in the middle of being dismissed. React Native Modal dismiss is async (animation), so the dismiss hasn't completed by the time the next `present` call arrives.

**How to apply:** Any time you dismiss a Modal (ActionSheet, BottomSheet, custom Modal) and then immediately call a picker or another modal: always use `setTimeout` + platform-conditional delay. Applies to all `launchImageLibraryAsync`, `launchCameraAsync`, and any `router.push` to modal screens that follows a sheet close.
