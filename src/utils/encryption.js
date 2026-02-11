export async function encryptFile(file, password = null) {
  let key
  let salt = null

  if (password) {
    salt = crypto.getRandomValues(new Uint8Array(16))
    key = await deriveKeyFromPassword(password, salt)
  } else {
    key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
  }

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const fileBuffer = await file.arrayBuffer()

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileBuffer
  )

  const exportedKey = password
    ? null
    : new Uint8Array(await crypto.subtle.exportKey('raw', key))

  return {
    encrypted: new Uint8Array(encrypted),
    key: exportedKey,
    iv,
    salt,
    passwordProtected: !!password
  }
}

export async function decryptFile(encryptedData, key, iv) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encryptedData
  )

  return new Uint8Array(decrypted)
}

export async function decryptFileWithPassword(encryptedData, password, saltBase64, ivBase64) {
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64))
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64))
  const key = await deriveKeyFromPassword(password, salt)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  )

  return new Uint8Array(decrypted)
}

async function deriveKeyFromPassword(password, salt) {
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(password)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
