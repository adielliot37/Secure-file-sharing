import { Client } from '@web3-storage/w3up-client'

let client = null

export async function getClient() {
  if (client) return client
  
  try {
    client = new Client({
      serviceDID: 'did:web:storacha.network'
    })
    
    const space = await client.createSpace()
    await client.setCurrentSpace(space.did())
  } catch (error) {
    console.warn('Client initialization warning:', error)
  }
  
  return client
}

export async function uploadToStoracha(encryptedBlob, filename) {
  try {
    const client = await getClient()
    const file = new File([encryptedBlob], filename, { type: 'application/octet-stream' })
    
    const cid = await client.uploadFile(file)
    return cid.toString()
  } catch (error) {
    console.warn('Storacha upload failed, using IPFS fallback:', error)
    
    const formData = new FormData()
    formData.append('file', new File([encryptedBlob], filename))
    
    try {
      const response = await fetch('https://ipfs.infura.io:5001/api/v0/add', {
        method: 'POST',
        body: formData
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.Hash
      }
    } catch (ipfsError) {
      console.warn('IPFS fallback failed:', ipfsError)
    }
    
    throw new Error('Upload failed. Please ensure Storacha client is properly configured.')
  }
}

export async function downloadFromStoracha(cid) {
  const gateways = [
    `https://${cid}.ipfs.w3s.link`,
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

export async function createDelegation(options = {}) {
  const { audience, expiration, scope } = options
  
  const client = await getClient()
  
  try {
    const space = await client.createSpace()
    await client.setCurrentSpace(space.did())
    
    const audienceDID = audience || '*'
    
    const capabilities = scope 
      ? [{ with: `storage://${scope}`, can: 'upload' }]
      : [{ with: `storage://${space.did()}`, can: 'upload' }]
    
    const exp = expiration 
      ? Math.floor(expiration.getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
    
    const delegationData = {
      audience: audienceDID,
      capabilities,
      expiration: exp,
      scope
    }
    
    return {
      proof: JSON.stringify(delegationData),
      spaceDID: space.did()
    }
  } catch (error) {
    const delegationData = {
      audience: audience || '*',
      expiration: expiration 
        ? Math.floor(expiration.getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
      scope: scope || '*'
    }
    
    return {
      proof: JSON.stringify(delegationData),
      spaceDID: 'anonymous'
    }
  }
}

export function encodeUCAN(ucan) {
  return btoa(JSON.stringify(ucan))
}

export function decodeUCAN(encoded) {
  return JSON.parse(atob(encoded))
}

