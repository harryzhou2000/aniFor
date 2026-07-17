const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

/** Encodes a backend save without coupling the URL format to backend internals. */
export async function encodeSharedWorld(serialized: string): Promise<string> {
  const source = textEncoder.encode(serialized);
  if (typeof CompressionStream === 'undefined') return `p.${bytesToBase64Url(source)}`;
  const compressed = await transform(source, new CompressionStream('gzip'));
  return `g.${bytesToBase64Url(compressed)}`;
}

export async function decodeSharedWorld(value: string): Promise<string> {
  const separator = value.indexOf('.');
  if (separator !== 1) throw new Error('Unknown shared-world format');
  const encoding = value.slice(0, separator);
  const bytes = base64UrlToBytes(value.slice(separator + 1));
  if (encoding === 'p') return textDecoder.decode(bytes);
  if (encoding !== 'g' || typeof DecompressionStream === 'undefined') throw new Error('Unsupported shared-world encoding');
  return textDecoder.decode(await transform(bytes, new DecompressionStream('gzip')));
}
