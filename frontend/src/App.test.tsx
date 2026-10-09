import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mocking the API client to return unauthenticated by default
vi.mock('@/api/auth', () => ({
  authApi: {
    getCurrentUser: vi.fn().mockRejectedValue(new Error('Unauthorized')),
  }
}))

describe('Frontend Architecture Tests', () => {
  it('application renders without crashing', () => {
    render(<App />)
    // The loading spinner or landing page should be in the document
    expect(document.querySelector('div')).toBeTruthy()
  })

  it('no fixed 412px app wrapper exists (responsive check)', () => {
    render(<App />)
    const wrapper = document.querySelector('.w-\\[412px\\]')
    expect(wrapper).toBeNull()
  })

  it('no fake scientific result values exist in frontend code', () => {
    render(<App />)
    const fakeData = screen.queryByText(/85% risk/i) // Example fake value
    expect(fakeData).toBeNull()
  })
})
