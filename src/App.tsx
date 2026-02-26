import React from 'react';
import { saveSession, getModelPreference, setModelPreference } from './lib/storage';
import { CodeEditor } from './components/CodeEditor';
import { RoastOutput } from './components/RoastOutput';
import { ModelSelector } from './components/ModelSelector';
import { ErrorBanner } from './components/ErrorBanner';
import { TemperatureControl } from './components/TemperatureControl';
import { RoastExport } from './components/RoastExport';
import { checkWebGPUSupport } from './lib/webgpu-check';

function App() {
  const [code, setCode] = React.useState('// paste code or load from GitHub URL');
  const [lang, setLang] = React.useState('javascript');
  const [roast, setRoast] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [model, setModel] = React.useState('Qwen2-1.5B-Instruct-q4f16_1-MLC');
  const [temperature, setTemperature] = React.useState(0.95);
  const [error, setError] = React.useState<string | null>(null);
  const [webgpuStatus, setWebgpuStatus] = React.useState<{ supported: boolean; message: string } | null>(null);
  const [history, setHistory] = React.useState<Array<{ question: string; answer: string }>>([]);

  const workerRef = React.useRef<Worker | null>(null);

  // Register service worker, check WebGPU, & load model preference
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.log('[App] Service Worker registration failed:', err);
      });
    }

    // Check WebGPU support
    checkWebGPUSupport().then((status) => {
      setWebgpuStatus(status);
      if (!status.supported) {
        setError(status.message);
      }
    });

    // Load saved model preference
    getModelPreference().then((savedModel) => {
      setModel(savedModel);
    });
  }, []);

  // Setup worker
  React.useEffect(() => {
    // Load worker without special syntax to avoid Vite's problematic worker bundling
    const workerUrl = new URL('./lib/worker.ts', import.meta.url).href;
    workerRef.current = new Worker(workerUrl, { type: 'module' });
    workerRef.current.onmessage = (e) => {
      const { type, token, full, error } = e.data;
      if (type === 'token') {
        setRoast((r) => r + token);
      } else if (type === 'done') {
        setLoading(false);
        // save to history/session
        setHistory((h) => {
          const newHist = [...h, { question: code, answer: full }];
          saveSession({ code, lang, model, history: newHist });
          return newHist;
        });
      } else if (type === 'error') {
        setLoading(false);
        setError(error || 'Failed to roast code. Check browser console for details.');
      }
    };
    workerRef.current.onerror = (err) => {
      setLoading(false);
      setError(`Worker error: ${err.message}`);
      console.error('[Worker Error]', err);
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, [code, lang, model]);

  const handleModelChange = async (newModel: string) => {
    setModel(newModel);
    await setModelPreference(newModel);
  };

  const triggerRoast = () => {
    setRoast('');
    setError(null);
    setLoading(true);
    workerRef.current?.postMessage({ code, lang, model, temperature });
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-4">
      <h1 className="text-3xl font-bold mb-6">CodeRoast 🔥🐵</h1>
      
      {error && (
        <ErrorBanner error={error} onDismiss={() => setError(null)} type="error" />
      )}

      {webgpuStatus && !webgpuStatus.supported && (
        <ErrorBanner 
          error="⚠️ WebGPU not available. Trying CPU fallback (very slow)..."
          type="warning"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Language:</label>
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)} 
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
          </select>
        </div>
        
        <ModelSelector value={model} onChange={handleModelChange} disabled={loading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <TemperatureControl value={temperature} onChange={setTemperature} disabled={loading} />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">GitHub URL:</label>
        <input
          type="text"
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          placeholder="https://github.com/user/repo/blob/main/file.js"
          onBlur={async (e) => {
            const url = e.target.value.trim();
            if (url) {
              try {
                const { fetchGitHubSource } = await import('./lib/githubFetcher');
                const text = await fetchGitHubSource(url);
                setCode(text);
              } catch (err) {
                console.error(err);
                setError('Failed to load GitHub URL');
              }
            }
          }}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Code:</label>
        <CodeEditor value={code} onChange={setCode} language={lang as any} />
      </div>

      <div className="mt-4 mb-6">
        <button
          onClick={triggerRoast}
          disabled={loading}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? '🔄 Roasting...' : '🔥 Roast me'}
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Roast Output:</h2>
        <RoastOutput text={roast} />
        {roast && (
          <RoastExport 
            roastText={roast}
            code={code}
            lang={lang}
            bananaScore={extractBananaScore(roast)}
          />
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">History</h2>
          <ul className="space-y-4">
            {history.map((h, i) => (
              <li key={i} className="border-l-4 border-red-500 pl-4 py-2">
                <details className="cursor-pointer">
                  <summary className="font-semibold text-gray-700 hover:text-red-600">
                    Roast #{history.length - i}
                  </summary>
                  <div className="mt-2 bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 mb-2"><strong>Code:</strong></p>
                    <pre className="bg-gray-200 p-2 rounded text-xs overflow-auto max-h-32 mb-3">
                      {h.question}
                    </pre>
                    <p className="text-xs text-gray-600 mb-2"><strong>Roast:</strong></p>
                    <RoastOutput text={h.answer} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Extract banana score from roast text (looks for "Banana Score: X/10")
function extractBananaScore(text: string): number | undefined {
  const match = text.match(/[Bb]anana\s+[Ss]core:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

export default App;