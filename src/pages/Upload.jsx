import { useState, useRef, useEffect } from 'react'
import { encryptFile, arrayBufferToBase64 } from '../utils/encryption'
import { uploadToStoracha, createDelegation, encodeUCAN } from '../utils/storacha'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [shareLink, setShareLink] = useState(null)
  const [expiration, setExpiration] = useState('')
  const [audience, setAudience] = useState('')
  const [password, setPassword] = useState('')
  const [maxViews, setMaxViews] = useState('')
  const [uploadMode, setUploadMode] = useState('file')
  const [noteText, setNoteText] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = (e) => {
      if (uploadMode === 'note') return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const blob = item.getAsFile()
          const ext = item.type.split('/')[1] || 'png'
          const pastedFile = new File([blob], `screenshot-${Date.now()}.${ext}`, { type: item.type })
          setFile(pastedFile)
          break
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [uploadMode])

  // Image preview
  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setImagePreview(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setImagePreview(null)
    }
  }, [file])

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

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    let uploadFile
    if (uploadMode === 'note') {
      if (!noteText.trim()) return
      const blob = new Blob([noteText], { type: 'text/secret-note' })
      uploadFile = new File([blob], 'secret-note.txt', { type: 'text/secret-note' })
    } else {
      if (!file) return
      uploadFile = file
    }

    setUploading(true)
    try {
      const encrypted = await encryptFile(uploadFile, password || null)
      const encryptedBlob = new Blob([encrypted.encrypted])

      const cid = await uploadToStoracha(encryptedBlob, `encrypted-${uploadFile.name}`)

      const expDate = expiration
        ? new Date(expiration)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

      const delegation = await createDelegation({
        audience: audience || null,
        expiration: expDate,
        scope: cid
      })

      const ivBase64 = arrayBufferToBase64(encrypted.iv)
      const proofBase64 = encodeUCAN(delegation.proof)

      const params = new URLSearchParams({
        cid,
        iv: ivBase64,
        proof: proofBase64,
        filename: uploadFile.name,
        type: uploadFile.type
      })

      if (encrypted.key) {
        params.append('key', arrayBufferToBase64(encrypted.key))
      }

      if (encrypted.salt) {
        params.append('salt', arrayBufferToBase64(encrypted.salt))
      }

      if (expiration) {
        params.append('exp', Math.floor(expDate.getTime() / 1000).toString())
      }

      if (maxViews) {
        params.append('maxViews', maxViews.toString())
      }

      const link = `${window.location.origin}/view?${params.toString()}`
      setShareLink(link)
    } catch (error) {
      console.error('Upload failed:', error)
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
    setAudience('')
    setPassword('')
    setMaxViews('')
    setUploadMode('file')
    setNoteText('')
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const hasContent = uploadMode === 'note' ? noteText.trim().length > 0 : !!file

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
            {/* Mode toggle */}
            <div className="flex mb-6 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              <button
                onClick={() => setUploadMode('file')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === 'file'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                File
              </button>
              <button
                onClick={() => setUploadMode('note')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === 'note'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Secret Note
              </button>
            </div>

            {uploadMode === 'file' ? (
              <>
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
                  />
                  <label
                    htmlFor="file-input"
                    className="cursor-pointer block"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-lg mb-4 border border-gray-200 dark:border-gray-600"
                      />
                    ) : (
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400 mb-4"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
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
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
                  or paste an image with Ctrl+V
                </p>
              </>
            ) : (
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full h-48 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Type your secret note here..."
              />
            )}

            {hasContent && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password (optional)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Leave empty for random key"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Audience DID (optional - leave empty for anyone)
                  </label>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="did:key:..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Self-destruct after N views (optional, per device)
                  </label>
                  <div className="flex gap-2 mb-2">
                    {[1, 3, 5, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMaxViews(maxViews === String(n) ? '' : String(n))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          maxViews === String(n)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={maxViews}
                    onChange={(e) => setMaxViews(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Custom number"
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
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Share Link Ready!
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Copy and share this link securely
              </p>
              {maxViews && (
                <span className="inline-block mt-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium rounded-full">
                  This link self-destructs after {maxViews} view{maxViews !== '1' ? 's' : ''} (per device)
                </span>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 break-all">
                {shareLink}
              </p>
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
