'use client'

import { useState } from 'react'
import { Button } from '../catalyst/button'
import { Divider } from '../catalyst/divider'
import { Heading } from '../catalyst/heading'
import { Input } from '../catalyst/input'

interface CreateAccountProps {
  onComplete: (email: string) => void
  signInInstead: () => void
  githubConnect: () => void
}

export default function CreateAccount({ onComplete, signInInstead, githubConnect }: CreateAccountProps) {
  const [email, setEmail] = useState('')

  const handleContinue = () => {
    if (email.trim()) {
      onComplete(email.trim())
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Heading className="text-center">Create an Account</Heading>
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
        <Button className="w-full space-y-4" onClick={githubConnect}>Connect with GitHub</Button>
      </section>
      <div className="flex flex-col items-end space-y-2 mt-10">
        <a className="cursor-pointer text-white hover:underline" style={{ opacity: 0.75 }} href="https://x.com/txtx_sol">
          Need an account? Ping us on X!
        </a>
      </div>
    </div>
  )
}
