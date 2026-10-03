# テキスト作業台

https://silovar-uk.github.io/worksportfolio/textworkbench/

HTML / CSS / Vanilla JavaScript. No external dependencies, analytics, or text transmission.

## Behavior

- Transforms apply to the selection, or the whole text when no selection exists.
- Opening replacement prefills the search field with selected text; its scope stays fixed while the sheet is open.
- Search is literal and non-overlapping. Case sensitivity is configurable. Replacement strings are literal, including `$`.
- Space collapse handles ordinary and ideographic spaces, not tabs or newlines. Empty-line actions also treat lines containing only spaces/tabs as empty.
- Full-width conversion changes only Latin letters and digits; kana and punctuation remain unchanged.
- Copy always copies the entire result.
- Undo/redo covers transformations, deletion, paste and grouped typing. History lasts for the current page session, capped at 100 snapshots and approximately 12 million UTF-16 units (a single larger snapshot remains recoverable).
- Text uses localStorage for device-local recovery. Clear removes the draft. Undoing Clear restores it.
- Clipboard API has manual paste and legacy copy fallbacks.
- IME composition blocks destructive transformations until committed.
- VisualViewport height/offset positions the workspace; safe-area padding applies without the keyboard.
- Service worker is scoped to this subdirectory; network-first caching enables offline reuse after the first load. No document contents enter the cache.
- iOS installation: Safari Share → Add to Home Screen.

## Validation (2026-10-03)

Passed: syntax check; 7 pure-transform cases; 700,000 UTF-16-unit input; live Chrome interaction checks for selection preservation, replacement autofill/count/all replacement, Undo, clipboard content and reload restoration.

Pending: physical iPhone Safari, keyboard open/close and caret visibility, Japanese IME, dark mode, small-iPhone layout, standalone/home-screen launch, offline launch, background suspension. The environment did not provide Safari/WebKit or configurable mobile browser emulation; these are not claimed as verified.
