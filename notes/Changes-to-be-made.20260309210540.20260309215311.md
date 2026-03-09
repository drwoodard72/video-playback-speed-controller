Changes to make: 20260309210540.20260309215311
Refined spec based on discussion.

## Configuration Panel

- Gear/config toggle button located inside the status line row, right-aligned.
- Clicking the gear button extends/retracts the UI downward to reveal/hide a configuration sub-panel below the status line.

## Increment/Decrement Mode (Radio Buttons)

### Percentage Mode
- Increment and decrement buttons use an absolute percentage value as their step.
- Label: "Percentage" with an input field for the step value and +/- buttons to adjust the step (step of 1).
- Default step value: 10%
- Behavior: absolute addition/subtraction to current speed percentage.
  - Example: current 10%, press "+" twice → 12% (with step=1%)
  - Example: current 20%, press "-" twice → 18% (with step=1%)
- All values clamped to 10%–1600%.

### Presets Mode (Default)
- Works like current behavior: snaps to the next preset value up/down.
- Preset list is user-editable (not fixed).

## Preset Editor (below Presets radio button)

### Per-preset row
- Editable value field
- Up/down buttons to reorder position in the list
- Delete button to remove from list
- 100% entry is undeletable but freely movable in the list

### Editor action buttons
- **Insert**: Add a new preset entry
- **Reset**: Restore the default preset list
- **Sort**: Auto-sort presets numerically

### Validation
- No duplicate values allowed
- Values clamped to 10%–1600%
- Decimal values allowed (e.g. 125% = 1.25x)

## Persistence
- All configuration (mode, percentage step, custom presets) saved globally via chrome.storage.local.
- Settings are saved and applied immediately as changes are made in the config panel.
