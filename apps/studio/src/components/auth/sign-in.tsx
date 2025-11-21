'use client'

import { useState } from 'react'
import { Button, Divider, Heading, Input } from '@surfpool/ui'

interface CreateAccountProps {
  onComplete: (email: string) => void
  githubConnect: () => void
  signUpInstead: () => void
}

export default function SignIn({ onComplete, signUpInstead, githubConnect }: CreateAccountProps) {
  const [email, setEmail] = useState('')

  const handleContinue = () => {
    if (email.trim()) {
      onComplete(email.trim())
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Heading className="text-center">Sign in</Heading>
      <Divider className="my-10 mt-6" soft />
      <section className="grid gap-y-6 lg:w-[320px]">
        <div className="w-full space-y-4">
          <Input
            type="email"
            aria-label="Email"
            name="email"
            placeholder="Enter your email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button className="w-full" onClick={handleContinue}>
          Continue
        </Button>
      </section>
      <Divider className="my-10" soft />
      <section className="grid w-full gap-y-6 lg:w-[320px]">
        <Button className="w-full space-y-4">Connect with a passkey</Button>
        <Button className="w-full space-y-4" onClick={githubConnect}>Connect with GitHub</Button>
      </section>
      <div className="flex flex-col items-end space-y-2 mt-10">
        <a className="cursor-pointer text-white hover:underline" style={{ opacity: 0.75 }} onClick={signUpInstead}>
          Don&apos;t have an account?
        </a>
      </div>
    </div>
  )
}
