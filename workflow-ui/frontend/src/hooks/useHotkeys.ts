import { useEffect } from 'react';

const TEXT_ENTRY_SELECTOR = 'input, textarea, [contenteditable="true"]';

/** Ctrl/Cmd+Z anywhere except while typing. */
export function useUndoHotkey(onUndo: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(TEXT_ENTRY_SELECTOR)) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        onUndo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo]);
}

/** Escape, bound only while `active` (used to close the detail panel). */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onEscape();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);
}
