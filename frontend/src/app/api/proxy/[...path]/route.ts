import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  const path = resolvedParams.path.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ''}`

  const accessToken = request.cookies.get('access_token')?.value

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  const path = resolvedParams.path.join('/')
  const url = `${BACKEND_URL}/${path}`

  const accessToken = request.cookies.get('access_token')?.value
  const contentType = request.headers.get('content-type') || ''

  let body: BodyInit | undefined
  let headers: Record<string, string> = {}

  if (contentType.includes('multipart/form-data')) {
    body = await request.blob()
  } else if (contentType.includes('application/json')) {
    body = await request.text()
    headers['Content-Type'] = 'application/json'
  } else {
    body = await request.text()
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  })

  // Handle token refresh on 401
  if (response.status === 401) {
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (refreshToken) {
      const refreshResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json()
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: {
            ...headers,
            'Authorization': `Bearer ${tokens.access_token}`,
          },
          body,
        })

        const nextResponse = new NextResponse(retryResponse.body, {
          status: retryResponse.status,
          headers: retryResponse.headers,
        })
        nextResponse.cookies.set('access_token', tokens.access_token, {
          httpOnly: true,
          path: '/',
          maxAge: 1800,
          sameSite: 'lax',
        })
        nextResponse.cookies.set('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          path: '/',
          maxAge: 604800,
          sameSite: 'lax',
        })
        return nextResponse
      }
    }
  }

  const nextResponse = new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  })

  // Forward set-cookie headers
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) {
    nextResponse.headers.set('set-cookie', setCookie)
  }

  return nextResponse
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, 'PUT')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, 'PATCH')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, 'DELETE')
}

async function proxyRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  const resolvedParams = await params
  const path = resolvedParams.path.join('/')
  const url = `${BACKEND_URL}/${path}`

  const accessToken = request.cookies.get('access_token')?.value
  const contentType = request.headers.get('content-type') || ''

  let body: BodyInit | undefined
  let headers: Record<string, string> = {}

  if (contentType.includes('application/json')) {
    body = await request.text()
    headers['Content-Type'] = 'application/json'
  } else {
    body = await request.text()
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  })

  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  })
}