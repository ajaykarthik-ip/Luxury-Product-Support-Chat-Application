'use client';

import AuthForm from '@/components/AuthForm';

/** Customer portal. Registering here always creates a CUSTOMER. */
export default function LoginPage() {
  return (
    <AuthForm
      role="CUSTOMER"
      subtitle="Product Support"
      crossLinkHref="/agent/login"
      crossLinkLabel="Support agent? Sign in to the agent portal"
    />
  );
}
