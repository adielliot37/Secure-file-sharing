import { useState, useRef, useEffect } from 'react'
import { encryptFile, arrayBufferToBase64 } from '../utils/encryption'
import { uploadToStoracha, createShareDelegation, authorizeClient, isClientAuthorized } from '../utils/storacha'

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2">
            Decentralized Share
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Encrypted, permanent, and controlled by you
          </p>
        </div>

        {!shareLink ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8">
            {checkingAuth ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-300">Checking authorization...</p>
              </div>
            ) : !authorized ? (
              <div className="mb-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Authorization Required
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  To upload files to Storacha, you need to authorize your client with an email address.
                </p>
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter your email address"
                  />
                  <button
                    onClick={handleAuthorize}
                    disabled={authorizing || !email}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {authorizing ? 'Authorizing...' : 'Authorize Storacha Client'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Storacha client authorized and ready to upload
                </p>
              </div>
            )}
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-300 dark:border-gray-600'
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
                className={isFileInputDisabled ? "cursor-not-allowed opacity-50 block" : "cursor-pointer block"}
              >
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {file ? file.name : 'Drop file here or click to select'}
                </p>
                {file && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </label>
            </div>

            {file && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recipient Email (leave empty for anyone with the link)
                  </label>
                  <input
                    type="email"
                    value={audienceEmail}
                    onChange={(e) => setAudienceEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="recipient@email.com"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Only this person will be able to view the file after verifying their email
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password (optional)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Recipient will need this password to decrypt"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Expiration Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload & Generate Link'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Share Link Ready!
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {audienceEmail
                  ? `Restricted to ${audienceEmail}`
                  : 'Anyone with this link can access the file'}
                {password && ' (password required)'}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 break-all">{shareLink}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Copy Link
              </button>
              <button
                onClick={reset}
                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
