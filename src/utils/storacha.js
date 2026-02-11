import { create } from '@storacha/client'
import * as DelegationCore from '@ucanto/core/delegation'
import * as ed25519 from '@ucanto/principal/ed25519'
import { verifySignature, isExpired } from '@ipld/dag-ucan'

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

export async function getAgentDID() {
  const client = await getClient()
  return client.agent.did()
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

export async function createShareDelegation({ key, iv, salt, passwordProtected, audienceDID, expiration }) {
  const client = await getClient()

  let audience
  if (audienceDID) {
    audience = ed25519.Verifier.parse(audienceDID)
  } else {
    audience = await ed25519.generate()
  }

  const exp = expiration
    ? Math.floor(expiration.getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365

  const facts = [{ iv }]
  if (passwordProtected) {
    facts[0].salt = salt
    facts[0].passwordProtected = true
  } else {
    facts[0].key = key
  }
  if (audienceDID) {
    facts[0].restricted = true
  }

  const delegation = await client.createDelegation(
    audience,
    ['upload/list'],
    {
      expiration: exp,
      facts
    }
  )

  const archive = await delegation.archive()
  if (archive.error) {
    throw new Error('Failed to create share delegation')
  }
  return uint8ArrayToBase64(archive.ok)
}

export async function extractShareDelegation(base64String, viewerDID) {
  const bytes = base64ToUint8Array(base64String)
  const result = await DelegationCore.extract(bytes)
  if (result.error) {
    throw new Error('Invalid or tampered share link')
  }
  const delegation = result.ok

  const issuerVerifier = ed25519.Verifier.parse(delegation.issuer.did())
  const signatureOk = await verifySignature(delegation.data, issuerVerifier)
  if (!signatureOk) {
    throw new Error('tampered')
  }

  if (isExpired(delegation.data)) {
    throw new Error('expired')
  }

  const facts = delegation.facts
  if (!facts || !facts.length || !facts[0].iv) {
    throw new Error('Invalid share link: missing data')
  }

  if (facts[0].restricted) {
    if (!viewerDID) {
      throw new Error('unauthorized')
    }
    if (delegation.audience.did() !== viewerDID) {
      throw new Error('unauthorized')
    }
  }

  return {
    key: facts[0].key || null,
    iv: facts[0].iv,
    salt: facts[0].salt || null,
    passwordProtected: !!facts[0].passwordProtected
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
