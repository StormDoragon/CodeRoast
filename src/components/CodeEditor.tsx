import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  language?: 'javascript' | 'typescript' | 'python';
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, language = 'javascript' }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const langExtension = 
      language === 'python' ? python() : 
      language === 'typescript' ? javascript({ typescript: true }) : 
      javascript();

    const state = EditorState.create({
      doc: value,
      extensions: [basicSetup, langExtension, oneDark],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
      dispatch: (tr) => {
        view.update([tr]);
        if (tr.docChanged) {
          onChange(view.state.doc.toString());
        }
      },
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [language]);

  // Sync external changes (from GitHub fetch)
  useEffect(() => {
    if (viewRef.current && viewRef.current.state.doc.toString() !== value) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className="w-full h-64 border border-gray-300 rounded overflow-hidden"
      style={{ fontSize: '14px' }}
    />
  );
};
