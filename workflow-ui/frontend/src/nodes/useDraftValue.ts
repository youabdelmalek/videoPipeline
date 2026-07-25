import { useEffect, useRef, useState } from 'react';

export function useDraftValue(value: string, onCommit: (value: string) => void) {
  const [draft, setDraft] = useState(value);
  const ownEcho = useRef(value);

  useEffect(() => {
    if (value !== ownEcho.current) {
      ownEcho.current = value;
      setDraft(value);
    }
  }, [value]);

  function edit(next: string) {
    ownEcho.current = next;
    setDraft(next);
    onCommit(next);
  }

  return [draft, edit] as const;
}
