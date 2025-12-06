import React from 'react'
import {SpeedAuthData} from './vite-env'
import {useCompletion} from '@ai-sdk/react'

export default function Example() {
  const [message, setMessage] = React.useState('')
  const [userData, setUserData] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)

  const {user, authLoading, login} = useAuth()

  const callBackendApi = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/example')
      const data = await response.json()
      setUserData(data)
    } catch (err: any) {
      setMessage(`Error calling backend function: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!user) {
      setMessage('Please login first to upload files')
      return
    }

    if (file) {
      try {
        setUploading(true)
        setMessage('')
        const fileUrl = await speed.upload.uploadFile(file)
        setUploadedImageUrl(fileUrl.url)
        setMessage('File uploaded successfully!')
      } catch (err: any) {
        setMessage(`Error uploading file: ${err.message}`)
      } finally {
        setUploading(false)
      }
    }
  }

  const {completion, input, handleInputChange, complete} = useCompletion({
    api: speed.llm.getEndpoint('gpt-4o-mini')
  })

  const handleAICompletion = () => {
    complete(`Make a exaggerated response for the following input: ${input}`)
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 text-center flex flex-col items-center justify-center min-h-screen">
      <div className="mb-8 w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-4">Backend API</h2>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <button
            onClick={callBackendApi}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Call Backend API'}
          </button>
          {userData && (
            <div className="mt-4 text-left">
              <h3 className="text-lg font-semibold mb-2">API Response:</h3>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm overflow-auto">{JSON.stringify(userData, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8 w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          {authLoading ? (
            <div className="text-gray-600">Checking authentication status...</div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <img src={user.photoUrl} alt={user.name} className="w-10 h-10 rounded-full" />
              <div className="text-left">
                <div className="font-medium text-green-800 dark:text-green-200">Welcome, {user.name}!</div>
                <div className="text-sm text-green-600 dark:text-green-400">ID: {user.id}</div>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-gray-600 dark:text-gray-400 mb-3">You are not logged in</div>
              <button onClick={login} className="px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all bg-green-600 hover:bg-green-700 text-white">
                Login
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8 w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-4">File Upload</h2>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          {user ? (
            <div className="space-y-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              {uploading && <div className="text-blue-600">Uploading...</div>}
              {uploadedImageUrl && (
                <div className="space-y-2">
                  <div className="text-green-600 text-sm">Image uploaded successfully!</div>
                  <img src={uploadedImageUrl} alt="Uploaded" className="max-w-full h-auto max-h-64 rounded-lg border" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-400">Please login to upload files</div>
          )}
        </div>
      </div>

      <div className="mb-8 w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-4">AI Text Completion</h2>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          {user ? (
            <div className="space-y-4">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Enter your prompt here..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAICompletion}
                disabled={!input.trim()}
                className="px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate
              </button>
              {completion && (
                <div className="mt-4 text-left">
                  <h3 className="text-lg font-semibold mb-2">AI Response:</h3>
                  <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm whitespace-pre-wrap">{completion}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-400">Please login to use AI text completion</div>
          )}
        </div>
      </div>

      {message && <p className="text-red-500 mt-4">{message}</p>}
    </div>
  )
}

export function useAuth() {
  const [authData, setAuthData] = React.useState<SpeedAuthData | null>(null)
  const [authError, setAuthError] = React.useState<Error | null>(null)
  const [authLoading, setAuthLoading] = React.useState(true)

  React.useEffect(() => {
    checkAuthStatus()
  }, [])

  async function checkAuthStatus() {
    try {
      setAuthLoading(true)
      setAuthData(await speed.auth.getCurrentUser())
    } catch (error) {
      console.error('Error checking auth status:', error)
      setAuthError(error as Error)
    } finally {
      setAuthLoading(false)
    }
  }

  return {
    user: authData?.user,
    token: authData?.token,
    authError,
    authLoading,
    isAuthenticated: !!authData,
    login: () => {
      speed.auth.login()
    },
    logout: () => {
      speed.auth.logout()
    }
  }
}
