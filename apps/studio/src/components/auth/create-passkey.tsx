"use client"

import type React from "react"
import { Heading, Divider, Input, Button } from "@surfpool/ui"
import { useState } from "react"

interface CreatePasskeyProps {
    onComplete: () => void;
    onSkip: () => void;
  }
  
  export default function CreatePasskey({ onComplete, onSkip }: CreatePasskeyProps) {
    return (
      <div className="w-full max-w-md mx-auto">
        <section className="grid my-5 gap-y-6">
          <div className="flex justify-center gap-4">
            <Button
              className="w-[320px]"
              onClick={() => onComplete()}
            >
              Create a Passkey
            </Button>
          </div>
        </section>
        <div className="flex flex-col items-start space-y-2">
          <button
            onClick={onSkip}
            className="text-white hover:underline text-left"
            style={{ opacity: 0.75 }}
          >
            Skip
          </button>
        </div>
      </div>
    );
  }