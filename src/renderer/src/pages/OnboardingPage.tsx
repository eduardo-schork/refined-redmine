import { useSession } from '@/hooks/session'
import { ConnectionForm } from '@/ui/organisms/ConnectionForm'
import { CenteredLayout } from '@/ui/templates/layouts'

export default function OnboardingPage() {
    // After a logout the address stays in the settings: only the key has to be typed again.
    const lastBaseUrl = useSession().data?.baseUrl || undefined
    return (
        <CenteredLayout>
            <ConnectionForm lastBaseUrl={lastBaseUrl} />
        </CenteredLayout>
    )
}
