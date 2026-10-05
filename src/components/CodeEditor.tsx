import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import type { Lang } from '../lib/analyzer';

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  language: Lang;
}

function langExtension(language: Lang) {
  if (language === 'python') return [python()];
  if (language === 'typescript') return [javascript({ typescript: true })];
  if (language === 'javascript') return [javascript({ jsx: true })];
  return [];
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, language }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: viewRef.current?.state.doc.toString() ?? value,
        extensions: [
          basicSetup,
          ...langExtension(language),
          oneDark,
          EditorView.lineWrapping,
          EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Sync external changes (examples, GitHub fetch).
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      ref={hostRef}
      aria-label="Code editor"
      className="h-80 md:h-[26rem] w-full overflow-hidden rounded-xl border border-zinc-800 text-sm"
    />
  );
};
