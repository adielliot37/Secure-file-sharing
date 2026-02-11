import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { decryptFile, decryptFileWithPassword, base64ToArrayBuffer } from '../utils/encryption'
import { downloadFromStoracha, extractShareDelegation, verifyViewerEmail } from '../utils/storacha'

function FlashLogo({ size = 'sm' }) {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10' }
  return (
    <div className={`${sizes[size]} relative inline-flex items-center justify-center`}>
      <div className="absolute inset-0 bg-amber-500/20 rounded-xl blur-xl"></div>
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-2/3 h-2/3" fill="none">
          <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" fill="url(#boltGradView)" />
          <defs>
            <linearGradient id="boltGradView" x1="4" y1="2" x2="18" y2="22">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="border-b border-zinc-800/50">
      <div className="container mx-auto px-4 py-4 max-w-4xl flex items-center gap-3">
        <FlashLogo size="sm" />
        <a href="/" className="font-brand text-xl font-bold tracking-tight text-white hover:text-amber-400 transition-colors">Flash</a>
      </div>
    </div>
  )
}

export default function View() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorType, setErrorType] = useState(null)
  const [fileData, setFileData] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [viewPassword, setViewPassword] = useState('')
  const [delegationData, setDelegationData] = useState(null)
  const [encryptedData, setEncryptedData] = useState(null)
  const [filename, setFilename] = useState('file')
  const [fileType, setFileType] = useState('application/octet-stream')
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const loadFile = async () => {
      try {
        const cidParam = searchParams.get('cid')
        const delegationBase64 = searchParams.get('d')
        const filenameParam = searchParams.get('filename') || 'file'
        const fileTypeParam = searchParams.get('type') || 'application/octet-stream'

        setFilename(filenameParam)
        setFileType(fileTypeParam)

        if (!cidParam || !delegationBase64) {
          throw new Error('Missing required parameters')
        }

        const extracted = await extractShareDelegation(delegationBase64)

        if (extracted.restricted) {
          const data = await downloadFromStoracha(cidParam)
          setEncryptedData(data)
          setDelegationData(extracted)
          setNeedsEmailVerification(true)
          setLoading(false)
          return
        }

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
        } else if (err.message === 'tampered') {
          setErrorType('tampered')
          setError('This share link has been tampered with and cannot be trusted.')
        } else {
          setError(err.message || 'Failed to load file')
        }
      } finally {
        setLoading(false)
      }
    }

    loadFile()
  }, [searchParams])

  const handleEmailVerification = async () => {
    if (!verificationEmail || !delegationData) return

    setVerifying(true)
    setError(null)
    try {
      const accountDID = await verifyViewerEmail(verificationEmail)

      if (accountDID !== delegationData.audienceDID) {
        setError('This file was not shared with this email address.')
        setVerifying(false)
        return
      }

      if (delegationData.passwordProtected) {
        setNeedsEmailVerification(false)
        setNeedsPassword(true)
        setVerifying(false)
        return
      }

      const key = base64ToArrayBuffer(delegationData.key)
      const iv = base64ToArrayBuffer(delegationData.iv)

      const decrypted = await decryptFile(
        new Uint8Array(encryptedData),
        key,
        new Uint8Array(iv)
      )

      setFileData({
        data: decrypted,
        filename,
        type: fileType
      })
      setNeedsEmailVerification(false)
    } catch (err) {
      setError('Email verification failed. Check your inbox and approve the login.')
    } finally {
      setVerifying(false)
    }
  }

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

  const isImage = fileData?.type?.startsWith('image/')
  const isVideo = fileData?.type?.startsWith('video/')
  const isPdf = fileData?.type === 'application/pdf'

  const errorIcons = {
    expired: (
      <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    tampered: (
      <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    )
  }

  const errorTitles = {
    expired: 'Link expired',
    tampered: 'Link invalid'
  }

  // Loading state
  if (loading && !needsPassword && !needsEmailVerification) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <Header />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 65px)' }}>
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-zinc-700 border-t-amber-500 mb-4"></div>
            <p className="text-zinc-500 text-sm">Fetching & decrypting...</p>
          </div>
        </div>
      </div>
    )
  }

  // Email verification
  if (needsEmailVerification && !fileData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <Header />
        <div className="flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 65px)' }}>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 max-w-md w-full backdrop-blur-sm">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Verify your email</h2>
              <p className="text-sm text-zinc-500">
                This file was shared with <span className="text-amber-400 font-medium">{delegationData?.audienceEmail}</span>
              </p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <div className="space-y-3">
              <input
                type="email"
                value={verificationEmail}
                onChange={(e) => { setVerificationEmail(e.target.value); setError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailVerification()}
                className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors text-sm"
                placeholder="Enter your email address"
                autoFocus
              />
              <button
                onClick={handleEmailVerification}
                disabled={!verificationEmail || verifying}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-2.5 px-4 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                {verifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    Verifying...
                  </span>
                ) : 'Verify'}
              </button>
              <p className="text-xs text-zinc-600 text-center">
                You'll receive a verification email from Storacha
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Password prompt
  if (needsPassword && !fileData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <Header />
        <div className="flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 65px)' }}>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 max-w-md w-full backdrop-blur-sm">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Password required</h2>
              <p className="text-sm text-zinc-500">This file is password protected</p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <div className="space-y-3">
              <input
                type="password"
                value={viewPassword}
                onChange={(e) => { setViewPassword(e.target.value); setError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors text-sm"
                placeholder="Enter password"
                autoFocus
              />
              <button
                onClick={handlePasswordSubmit}
                disabled={!viewPassword || loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-2.5 px-4 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    Decrypting...
                  </span>
                ) : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <Header />
        <div className="flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 65px)' }}>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center backdrop-blur-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl mb-4">
              {errorIcons[errorType] || (
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              {errorTitles[errorType] || 'Something went wrong'}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">{error}</p>
            <a
              href="/"
              className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-2.5 px-6 rounded-xl transition-all text-sm"
            >
              Share a file
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!fileData) return null

  // File view
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Header />
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
              {fileData.filename}
            </h1>
            <p className="text-sm text-zinc-600">
              {(fileData.data.length / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          <div className="mb-6">
            {isImage && (
              <img
                src={URL.createObjectURL(new Blob([fileData.data], { type: fileData.type }))}
                alt={fileData.filename}
                className="max-w-full h-auto rounded-xl border border-zinc-800 mx-auto"
              />
            )}
            {isVideo && (
              <video
                controls
                className="max-w-full h-auto rounded-xl border border-zinc-800 mx-auto"
                src={URL.createObjectURL(new Blob([fileData.data], { type: fileData.type }))}
              />
            )}
            {isPdf && (
              <iframe
                src={URL.createObjectURL(new Blob([fileData.data], { type: fileData.type }))}
                className="w-full h-[600px] rounded-xl border border-zinc-800"
                title={fileData.filename}
              />
            )}
            {!isImage && !isVideo && !isPdf && (
              <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-12 text-center">
                <svg className="mx-auto h-14 w-14 text-zinc-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-zinc-600">Preview not available for this file type</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadFile}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-3 px-6 rounded-xl transition-all text-sm"
            >
              Download
            </button>
            <a
              href="/"
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm text-center"
            >
              Share a file
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
