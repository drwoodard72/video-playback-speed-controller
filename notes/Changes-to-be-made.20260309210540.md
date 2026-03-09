Changes to make: 20260309210540

- add configuration capabilities
  - config button located on the same line as the status line aligned to the right of the pop-up that extends/retracts the ui down/up to make room for a configuration sub pannel to be located below the status line.

- configuration sub pannel
  - two radio buttons controlling the increment/decrement behavior
      - first radio: percentage 
         - when selected, the increment and decrement speed buttons use the percentage value as their increment/decrement by value. 
         - label as "percentage" and include an input field for the percentage value with +/- button control to increment/decrement the persentage value with a step of 1.
         - default value of 10%
         - example behavior: if current value is 10%, pressing "+" twice will result in 12%
         - example behavior: if current value is 20%  pressing "-" twice will result in 18%
      - second radio: presets
         - works exactly like current behavior except presets are not a fixed list
  - below the presets radio button add an interface to edit the list of presets
     - include a "reset button" to restore the default list of presets
     - design the interface so each preset value takes one line and includes an editable field for the value, up/down buttons to move it's position in the list and a delete button to remove it from the list.
     - hard code the 100% preset list entry to be undeletable.
  - save and apply configuation settings as they are made in the configuration sub pannel

