/**
 * Client-side encryption and decryption of JSON strings using native Web Crypto API (AES-GCM 256).
 * This ensures HIPAA/GDPR clinical safety without external library dependencies.
 */

const ITERATIONS = 100000;
const KEY_LEN = 256;

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
  const saltBase64 = btoa(Array.from(salt, byte => String.fromCharCode(byte)).join(''));
  const ivBase64 = btoa(Array.from(iv, byte => String.fromCharCode(byte)).join(''));
  const ciphertextBase64 = btoa(Array.from(encryptedBytes, byte => String.fromCharCode(byte)).join(''));

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

  const salt = new Uint8Array(atob(data.salt).split('').map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(data.iv).split('').map(c => c.charCodeAt(0)));
  const ciphertext = new Uint8Array(atob(data.ciphertext).split('').map(c => c.charCodeAt(0)));

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
