'use client';

import AuthForm from '@/components/AuthForm';

/** Agent portal. Registering here always creates an AGENT. */
export default function AgentLoginPage() {
  return (
    <AuthForm
      role="AGENT"
      subtitle="Agent Portal"
      crossLinkHref="/login"
      crossLinkLabel="Are you a customer? Go to the customer portal"
    />
  );
}
