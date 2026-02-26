export async function checkWebGPUSupport(): Promise<{
  supported: boolean;
  message: string;
  recommendation: string;
}> {
  if (!navigator.gpu) {
    return {
      supported: false,
      message: 'WebGPU is not available on this browser.',
      recommendation:
        'Please use Chrome/Chromium 113+, Edge 113+, or Firefox with WebGPU enabled. You can try fallback CPU mode, but it will be slow.',
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        message: 'No WebGPU adapter found on this device.',
        recommendation: 'Your device may not have compatible graphics hardware. Try updating drivers or using a different device.',
      };
    }

    return {
      supported: true,
      message: 'WebGPU is available. Ready to roast! 🔥',
      recommendation: '',
    };
  } catch (err) {
    return {
      supported: false,
      message: `WebGPU check failed: ${err instanceof Error ? err.message : String(err)}`,
      recommendation: 'Try refreshing the page or using a different browser.',
    };
  }
}
