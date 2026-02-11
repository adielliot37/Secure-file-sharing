import { useState, useRef, useEffect } from 'react'
import { encryptFile, arrayBufferToBase64 } from '../utils/encryption'
import { uploadToStoracha, createShareDelegation, authorizeClient, isClientAuthorized } from '../utils/storacha'

function FlashLogo({ size = 'lg' }) {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' }
  return (
    <div className={`${sizes[size]} relative inline-flex items-center justify-center`}>
      <div className="absolute inset-0 bg-amber-500/20 rounded-2xl blur-xl"></div>
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-2/3 h-2/3" fill="none">
          <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" fill="url(#boltGrad)" />
          <defs>
            <linearGradient id="boltGrad" x1="4" y1="2" x2="18" y2="22">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}

export default function Upload() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [shareLink, setShareLink] = useState(null)
  const [expiration, setExpiration] = useState('')
  const [audienceEmail, setAudienceEmail] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const isAuth = await isClientAuthorized()
        setAuthorized(isAuth)
      } catch (error) {
        setAuthorized(false)
      } finally {
        setCheckingAuth(false)
      }
    }
    init()
  }, [])

  const handleAuthorize = async () => {
    if (!email) {
      alert('Please enter an email address')
      return
    }
    setAuthorizing(true)
    try {
      const result = await authorizeClient(email)
      if (result.success) {
        setAuthorized(true)
        alert(result.message)
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert(`Authorization failed: ${error.message}`)
    } finally {
      setAuthorizing(false)
    }
  }

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return
    if (!authorized) {
      alert('Please authorize your Storacha client first.')
      return
    }

    setUploading(true)
    try {
      const encrypted = await encryptFile(file, password || null)
      const encryptedBlob = new Blob([encrypted.encrypted])
      const cid = await uploadToStoracha(encryptedBlob, `encrypted-${file.name}`)

      const expDate = expiration
        ? new Date(expiration)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

      const delegationOptions = {
        iv: arrayBufferToBase64(encrypted.iv),
        passwordProtected: encrypted.passwordProtected,
        audienceEmail: audienceEmail.trim() || null,
        expiration: expDate
      }

      if (encrypted.passwordProtected) {
        delegationOptions.salt = arrayBufferToBase64(encrypted.salt)
      } else {
        delegationOptions.key = arrayBufferToBase64(encrypted.key)
      }

      const delegationBase64 = await createShareDelegation(delegationOptions)

      const params = new URLSearchParams({
        cid,
        d: delegationBase64,
        filename: file.name,
        type: file.type
      })

      const link = `${window.location.origin}/view?${params.toString()}`
      setShareLink(link)
    } catch (error) {
      alert('Upload failed: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    alert('Link copied to clipboard!')
  }

  const reset = () => {
    setFile(null)
    setShareLink(null)
    setExpiration('')
    setAudienceEmail('')
    setPassword('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isFileInputDisabled = checkingAuth || !authorized

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-zinc-800/50">
        <div className="container mx-auto px-4 py-4 max-w-4xl flex items-center gap-3">
          <FlashLogo size="md" />
          <span className="font-brand text-xl font-bold tracking-tight text-white">Flash</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <FlashLogo size="lg" />
          </div>
          <h1 className="font-brand text-5xl md:text-6xl font-bold tracking-tight mb-3">
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent">Flash</span>
          </h1>
          <p className="text-zinc-400 text-lg tracking-wide">
            Private sharing in a flash.
          </p>
        </div>

        {!shareLink ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
            {checkingAuth ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-zinc-700 border-t-amber-500 mb-3"></div>
                <p className="text-zinc-500 text-sm">Checking authorization...</p>
              </div>
            ) : !authorized ? (
              <div className="mb-6 p-5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <h3 className="text-base font-semibold text-white mb-1">
                  Connect your identity
                </h3>
                <p className="text-sm text-zinc-500 mb-4">
                  Authorize with your email to start sharing files.
                </p>
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors text-sm"
                    placeholder="you@email.com"
                  />
                  <button
                    onClick={handleAuthorize}
                    disabled={authorizing || !email}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-2.5 px-4 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {authorizing ? 'Authorizing...' : 'Authorize'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <p className="text-sm text-emerald-400">Ready to share</p>
              </div>
            )}

            {/* Drop Zone */}
            <div
              className={`border border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                dragActive
                  ? 'border-amber-500 bg-amber-500/5'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
                disabled={isFileInputDisabled}
              />
              <label
                htmlFor="file-input"
                className={isFileInputDisabled ? "cursor-not-allowed opacity-40 block" : "cursor-pointer block"}
              >
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                    <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm font-medium text-zinc-300 mb-1">
                  {file ? file.name : 'Drop a file or click to select'}
                </p>
                {file && (
                  <p className="text-xs text-zinc-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
                {!file && (
                  <p className="text-xs text-zinc-600">Any file type, encrypted before upload</p>
                )}
              </label>
            </div>

            {/* Options */}
            {file && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Recipient email
                  </label>
                  <input
                    type="email"
                    value={audienceEmail}
                    onChange={(e) => setAudienceEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors text-sm"
                    placeholder="Leave empty for anyone with the link"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors text-sm"
                    placeholder="Optional — adds extra protection"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Expires
                  </label>
                  <input
                    type="datetime-local"
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value)}
                    className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors text-sm"
                  />
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm mt-2"
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                      Encrypting & uploading...
                    </span>
                  ) : (
                    'Flash it'
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Share link result */
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">
                Link ready
              </h2>
              <p className="text-sm text-zinc-500">
                {audienceEmail
                  ? `Restricted to ${audienceEmail}`
                  : 'Anyone with this link can access the file'}
                {password && ' — password protected'}
              </p>
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 mb-4">
              <p className="text-xs text-zinc-400 break-all font-mono leading-relaxed">{shareLink}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-3 px-6 rounded-xl transition-all text-sm"
              >
                Copy link
              </button>
              <button
                onClick={reset}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
              >
                New file
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-zinc-700">
            End-to-end encrypted. Decentralized storage. No accounts needed to view.
          </p>
        </div>
      </div>
    </div>
  )
}
