self.addEventListener('message', async (e) => {
  const { code, lang, model = 'Qwen2-1.5B-Instruct-q4f16_1-MLC', temperature = 0.95 } = e.data;
  try {
    // Dynamically import the roast module to avoid bundling issues
    const { roastCode } = await import('./roast');
    let full = '';
    await roastCode(code, lang, model, temperature, (token: string) => {
      full += token;
      self.postMessage({ type: 'token', token });
    });
    self.postMessage({ type: 'done', full });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', error: errorMsg });
  }
});
