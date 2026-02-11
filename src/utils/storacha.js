import { create } from '@storacha/client'
import * as DelegationCore from '@ucanto/core/delegation'
import * as ed25519 from '@ucanto/principal/ed25519'

let client = null
let isAuthorized = false

export async function getClient() {
  if (client) return client
  try {
    client = await create()
  } catch (error) {
    console.error('Client initialization error:', error)
    throw error
  }
  return client
}

export async function authorizeClient(email) {
  if (!email) {
    throw new Error('Email is required for authorization')
  }
  try {
    const client = await getClient()
    if (!client) {
      throw new Error('Failed to initialize client')
    }
    const account = await client.login(email)
    let space = client.currentSpace()
    if (!space) {
      space = await client.createSpace('storacha-share', { account, skipGatewayAuthorization: true })
      await client.setCurrentSpace(space.did())
    }
    isAuthorized = true
    return {
      success: true,
      message: 'Authorization successful! You can now upload files.'
    }
  } catch (error) {
    console.error('Authorization error:', error)
    throw new Error(`Failed to authorize client: ${error.message}`)
  }
}

export async function isClientAuthorized() {
  try {
    const client = await getClient()
    if (!client) return false
    const currentSpace = client.currentSpace()
    if (!currentSpace) {
      isAuthorized = false
      return false
    }
    isAuthorized = true
    return true
  } catch (error) {
    isAuthorized = false
    return false
  }
}

export async function uploadToStoracha(encryptedBlob, filename) {
  try {
    const client = await getClient()
    if (!isAuthorized) {
      const authorized = await isClientAuthorized()
      if (!authorized) {
        throw new Error('Client not authorized. Please authorize with an email address first.')
      }
    }
    const file = new File([encryptedBlob], filename, { type: 'application/octet-stream' })
    const cid = await client.uploadFile(file)
    return cid.toString()
  } catch (error) {
    if (error.message.includes('not authorized') || error.message.includes('authorize')) {
      throw error
    }
    throw new Error(`Upload failed: ${error.message}`)
  }
}

export async function downloadFromStoracha(cid) {
  const gateways = [
    `https://${cid}.ipfs.storacha.link`,
    `https://${cid}.ipfs.dweb.link`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`
  ]
  for (const gateway of gateways) {
    try {
      const response = await fetch(gateway)
      if (response.ok) {
        return await response.arrayBuffer()
      }
    } catch (error) {
      continue
    }
  }
  throw new Error('Failed to fetch file from any gateway')
}

export async function createShareDelegation({ key, iv, expiration }) {
  const client = await getClient()
  const audience = await ed25519.generate()
  const exp = expiration
    ? Math.floor(expiration.getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365

  const delegation = await client.createDelegation(
    audience,
    ['upload/list'],
    {
      expiration: exp,
      facts: [{ key, iv }]
    }
  )

  const archive = await delegation.archive()
  if (archive.error) {
    throw new Error('Failed to create share delegation')
  }
  return uint8ArrayToBase64(archive.ok)
}

export async function extractShareDelegation(base64String) {
  const bytes = base64ToUint8Array(base64String)
  const result = await DelegationCore.extract(bytes)
  if (result.error) {
    throw new Error('Invalid or tampered share link')
  }
  const delegation = result.ok

  if (delegation.expiration !== undefined && delegation.expiration !== Infinity) {
    if (Date.now() / 1000 > delegation.expiration) {
      throw new Error('expired')
    }
  }

  const facts = delegation.facts
  if (!facts || !facts.length || !facts[0].key || !facts[0].iv) {
    throw new Error('Invalid share link: missing encryption data')
  }

  return {
    key: facts[0].key,
    iv: facts[0].iv
  }
}

function uint8ArrayToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8Array(base64String) {
  const binary = atob(base64String)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
