import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './app/App'
import './styles.css'

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true, staleTime: 30_000 } }
})

const rootElement = document.getElementById('root')!

createRoot(rootElement).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </StrictMode>
)
