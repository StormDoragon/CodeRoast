declare module 'web-tree-sitter' {
  const Parser: any;
  export default Parser;
}

declare module '*.wasm' {
  const url: string;
  export default url;
}

declare module '*.wasm?init' {
  const init: any;
  export default init;
}

// WebGPU types
interface Navigator {
  gpu?: GPU;
}

interface GPU {
  requestAdapter(options?: any): Promise<GPUAdapter | null>;
}

interface GPUAdapter {
  requestDevice(descriptor?: any): Promise<GPUDevice>;
}

interface GPUDevice {
  queue: GPUQueue;
}

interface GPUQueue {
  submit(commandBuffers: any[]): void;
}
