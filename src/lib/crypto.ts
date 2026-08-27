/**
 * Client-side encryption and decryption of JSON strings using native Web Crypto API (AES-GCM 256).
 * This ensures HIPAA/GDPR clinical safety without external library dependencies.
 */

const ITERATIONS = 100000;
const KEY_LEN = 256;

function bytesToBase64(bytes: Uint8Array): string {
  const base64abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i;
  const l = bytes.length;
  for (i = 2; i < l; i += 3) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    result += base64abc[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)];
    result += base64abc[bytes[i] & 0x3f];
  }
  if (i === l + 1) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[(bytes[i - 2] & 0x03) << 4];
    result += '==';
  }
  if (i === l) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    result += base64abc[(bytes[i - 1] & 0x0f) << 2];
    result += '=';
  }
  return result;
}

function base64ToBytes(base64: string): Uint8Array {
  const base64abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < base64abc.length; i++) {
    lookup[base64abc.charCodeAt(i)] = i;
  }
  let padCount = 0;
  if (base64.endsWith('==')) padCount = 2;
  else if (base64.endsWith('=')) padCount = 1;

  const len = Math.floor((base64.length * 3) / 4) - padCount;
  const bytes = new Uint8Array(len);

  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const enc1 = lookup[base64.charCodeAt(i)];
    const enc2 = lookup[base64.charCodeAt(i + 1)];
    const enc3 = lookup[base64.charCodeAt(i + 2)];
    const enc4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (p < len) bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (p < len) bytes[p++] = ((enc3 & 3) << 6) | (enc4 & 63);
  }
  return bytes;
}

async function getKek(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJSON(data: any, password?: string): Promise<string> {
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(jsonString);

  // If no password, return unencrypted wrapper
  if (!password) {
    return JSON.stringify({ encrypted: false, payload: jsonString });
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await getKek(password, salt);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    plainBytes
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  
  // Convert bytes to base64 strings for storage/JSON
  const saltBase64 = bytesToBase64(salt);
  const ivBase64 = bytesToBase64(iv);
  const ciphertextBase64 = bytesToBase64(encryptedBytes);

  return JSON.stringify({
    encrypted: true,
    salt: saltBase64,
    iv: ivBase64,
    ciphertext: ciphertextBase64
  });
}

export async function decryptJSON(encryptedJsonString: string, password?: string): Promise<any> {
  const data = JSON.parse(encryptedJsonString);

  if (!data.encrypted) {
    return JSON.parse(data.payload);
  }

  if (!password) {
    throw new Error('This backup is encrypted. Please provide a password to restore.');
  }

  const salt = base64ToBytes(data.salt);
  const iv = base64ToBytes(data.iv);
  const ciphertext = base64ToBytes(data.ciphertext);

  const key = await getKek(password, salt);
  
  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);
    return JSON.parse(decryptedString);
  } catch (error) {
    throw new Error('Incorrect password or corrupted backup file.');
  }
}
