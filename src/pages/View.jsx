import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { decryptFile, base64ToArrayBuffer } from '../utils/encryption'
import { downloadFromStoracha, decodeUCAN } from '../utils/storacha'

export default function View() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fileData, setFileData] = useState(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const loadFile = async () => {
      try {
        const cid = searchParams.get('cid')
        const keyBase64 = searchParams.get('key')
        const ivBase64 = searchParams.get('iv')
        const proofBase64 = searchParams.get('proof')
        const filename = searchParams.get('filename') || 'file'
        const fileType = searchParams.get('type') || 'application/octet-stream'
        const exp = searchParams.get('exp')

        if (!cid || !keyBase64 || !ivBase64) {
          throw new Error('Missing required parameters')
        }

        if (exp) {
          const expTime = parseInt(exp) * 1000
          if (Date.now() > expTime) {
            setExpired(true)
            setError('This link has expired')
            setLoading(false)
            return
          }
        }

        if (proofBase64) {
          try {
            const proof = decodeUCAN(proofBase64)
            if (proof.exp && proof.exp * 1000 < Date.now()) {
              setExpired(true)
              setError('This link has expired')
              setLoading(false)
              return
            }
          } catch (e) {
            console.warn('Could not verify UCAN proof:', e)
          }
        }

        const encryptedData = await downloadFromStoracha(cid)
        const key = base64ToArrayBuffer(keyBase64)
        const iv = base64ToArrayBuffer(ivBase64)

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
      } catch (err) {
        setError(err.message || 'Failed to load file')
      } finally {
        setLoading(false)
      }
    }

    loadFile()
  }, [searchParams])

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Loading file...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {expired ? 'Link Expired' : 'Error'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
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
                <svg
                  className="mx-auto h-16 w-16 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-gray-600 dark:text-gray-400">
                  Preview not available for this file type
                </p>
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

