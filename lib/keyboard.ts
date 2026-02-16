export const ADMIN_KEYMAP = [
  { key: "Arrow Keys", action: "Navigate between cells" },
  { key: "Tab / Shift+Tab", action: "Move horizontally" },
  { key: "Enter / Shift+Enter", action: "Commit and move vertically" },
  { key: "Esc", action: "Cancel editing" },
  { key: "⌘C / Ctrl+C", action: "Copy cell" },
  { key: "⌘V / Ctrl+V", action: "Paste cell" },
  { key: "⌘D / Ctrl+D", action: "Fill down selected value" },
  { key: "⌘S / Ctrl+S", action: "Force sync flush + sheet pull" },
  { key: "?", action: "Toggle keyboard shortcuts help" },
] as const;
