import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { decryptFile, decryptFileWithPassword, base64ToArrayBuffer } from '../utils/encryption'
import { downloadFromStoracha, extractShareDelegation, getAgentDID } from '../utils/storacha'

export default function View() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorType, setErrorType] = useState(null)
  const [fileData, setFileData] = useState(null)
  const [viewerDID, setViewerDID] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [viewPassword, setViewPassword] = useState('')
  const [delegationData, setDelegationData] = useState(null)
  const [encryptedData, setEncryptedData] = useState(null)
  const [cid, setCid] = useState(null)
  const [filename, setFilename] = useState('file')
  const [fileType, setFileType] = useState('application/octet-stream')

  useEffect(() => {
    const loadFile = async () => {
      try {
        const did = await getAgentDID()
        setViewerDID(did)

        const cidParam = searchParams.get('cid')
        const delegationBase64 = searchParams.get('d')
        const filenameParam = searchParams.get('filename') || 'file'
        const fileTypeParam = searchParams.get('type') || 'application/octet-stream'

        setCid(cidParam)
        setFilename(filenameParam)
        setFileType(fileTypeParam)

        if (!cidParam || !delegationBase64) {
          throw new Error('Missing required parameters')
        }

        const extracted = await extractShareDelegation(delegationBase64, did)

        if (extracted.passwordProtected) {
          const data = await downloadFromStoracha(cidParam)
          setEncryptedData(data)
          setDelegationData(extracted)
          setNeedsPassword(true)
          setLoading(false)
          return
        }

        const data = await downloadFromStoracha(cidParam)
        const key = base64ToArrayBuffer(extracted.key)
        const iv = base64ToArrayBuffer(extracted.iv)

        const decrypted = await decryptFile(
          new Uint8Array(data),
          key,
          new Uint8Array(iv)
        )

        setFileData({
          data: decrypted,
          filename: filenameParam,
          type: fileTypeParam
        })
      } catch (err) {
        if (err.message === 'expired') {
          setErrorType('expired')
          setError('This share link has expired')
        } else if (err.message === 'unauthorized') {
          setErrorType('unauthorized')
          setError('You are not authorized to view this file. This link was shared with a different recipient.')
        } else if (err.message === 'tampered') {
          setErrorType('tampered')
          setError('This share link has been tampered with and cannot be trusted.')
        } else {
          setError(err.message || 'Failed to load file')
        }
      } finally {
        if (!needsPassword) {
          setLoading(false)
        }
      }
    }

    loadFile()
  }, [searchParams])

  const handlePasswordSubmit = async () => {
    if (!viewPassword || !delegationData || !encryptedData) return

    try {
      setLoading(true)
      const decrypted = await decryptFileWithPassword(
        new Uint8Array(encryptedData),
        viewPassword,
        delegationData.salt,
        delegationData.iv
      )

      setFileData({
        data: decrypted,
        filename,
        type: fileType
      })
      setNeedsPassword(false)
    } catch (err) {
      setError('Wrong password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = () => {
    if (!fileData) return
    const blob = new Blob([fileData.data], { type: fileData.type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileData.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyDID = () => {
    navigator.clipboard.writeText(viewerDID)
    alert('DID copied to clipboard!')
  }

  const isImage = fileData?.type?.startsWith('image/')
  const isVideo = fileData?.type?.startsWith('video/')
  const isPdf = fileData?.type === 'application/pdf'

  const errorTitles = {
    expired: 'Link Expired',
    unauthorized: 'Access Denied',
    tampered: 'Invalid Link'
  }

  if (loading && !needsPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Loading file...</p>
        </div>
      </div>
    )
  }

  if (needsPassword && !fileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
          {viewerDID && (
            <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Your DID</p>
              <p className="text-xs text-gray-700 dark:text-gray-300 truncate font-mono">{viewerDID}</p>
            </div>
          )}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full mb-4">
              <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Password Required</h2>
            <p className="text-gray-600 dark:text-gray-300">This file is password protected</p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
          <div className="space-y-3">
            <input
              type="password"
              value={viewPassword}
              onChange={(e) => { setViewPassword(e.target.value); setError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter password"
              autoFocus
            />
            <button
              onClick={handlePasswordSubmit}
              disabled={!viewPassword || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Decrypting...' : 'Decrypt File'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (error && !needsPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          {viewerDID && errorType === 'unauthorized' && (
            <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-left">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Your DID</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-700 dark:text-gray-300 truncate font-mono flex-1">{viewerDID}</p>
                <button onClick={copyDID} className="text-xs text-indigo-600 hover:text-indigo-700 shrink-0">Copy</button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Share this DID with the sender so they can grant you access</p>
            </div>
          )}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {errorTitles[errorType] || 'Error'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <a href="/" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
            Upload a File
          </a>
        </div>
      </div>
    )
  }

  if (!fileData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {fileData.filename}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {(fileData.data.length / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          <div className="mb-6">
            {isImage && (
              <img
                src={URL.createObjectURL(new Blob([fileData.data], { type: fileData.type }))}
                alt={fileData.filename}
                className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
              />
            )}
            {isVideo && (
              <video
                controls
                className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
                src={URL.createObjectURL(new Blob([fileData.data], { type: fileData.type }))}
              />
            )}
            {isPdf && (
              <iframe
                src={URL.createObjectURL(new Blob([fileData.data], { type: fileData.type }))}
                className="w-full h-[600px] rounded-lg shadow-lg"
                title={fileData.filename}
              />
            )}
            {!isImage && !isVideo && !isPdf && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-12 text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400">Preview not available for this file type</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadFile}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Download
            </button>
            <a
              href="/"
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center"
            >
              Upload File
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
