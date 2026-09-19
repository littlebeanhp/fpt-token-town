'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Terminal, X } from 'lucide-react';
import type { ModelDefinition } from '@/types/factory';

export function ApiDialog({ model, onClose }: { model?: ModelDefinition; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sample = [
    'curl "$FPT_API_BASE/chat/completions" \\',
    '  -H "Authorization: Bearer $FPT_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '{\n    "model": "${model?.id ?? '<model-id>'}",\n    "messages": [{"role": "user", "content": "Hello, FPT."}]\n  }'`,
  ].join('\n');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(sample);
      setCopied(true);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="api-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-top">
        <span className="eyebrow">
          <Terminal size={14} /> API WORKSPACE
        </span>
        <button
          className="icon-button"
          aria-label="Close API dialog"
          title="Close"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <h2>Connect your next idea.</h2>
      <p>
        {model?.name ?? 'FPT AI Token Factory'}{' '}
        <span className="demo-tag">Integration preview</span>
      </p>
      <div className="code-heading">
        <span>OpenAI-compatible request template</span>
        <button
          className="icon-button"
          onClick={copy}
          aria-label="Copy API example"
          title={copied ? 'Copied' : 'Copy request'}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
        </button>
      </div>
      <pre>
        <code>{sample}</code>
      </pre>
      <p className="api-note">
        An API endpoint and credentials are not connected to this demo. Replace the base URL and
        model ID with values from your provisioned FPT catalog.
      </p>
      <button className="primary-button" onClick={onClose}>
        Back to the city
      </button>
    </dialog>
  );
}
