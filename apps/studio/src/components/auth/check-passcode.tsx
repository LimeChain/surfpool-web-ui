"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Input } from "@surfpool/ui"

interface CheckPasscodeProps {
  onComplete: (code: string) => void
  onCancel: () => void
}

export default function CheckPasscode({ onComplete, onCancel }: CheckPasscodeProps) {
  const [code, setCode] = useState<string[]>(Array(6).fill(""))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6)
  }, [])

  // Handle input change
  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    // Take only the last character if multiple are pasted
    newCode[index] = value.slice(-1)
    setCode(newCode)

    // Move to next input if a digit was entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Check if all digits are entered
    const updatedCode = [...newCode]
    if (!updatedCode.includes("") && onComplete) {
      onComplete(updatedCode.join(""))
    }
  }

  // Handle key press
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      // Move to previous input on backspace if current input is empty
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowLeft" && index > 0) {
      // Move to previous input on left arrow
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 5) {
      // Move to next input on right arrow
      inputRefs.current[index + 1]?.focus()
    }
  }

  // Handle paste event
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text/plain").trim()

    // Check if pasted content contains only digits
    if (!/^\d+$/.test(pastedData)) return

    const digits = pastedData.slice(0, 6).split("")
    const newCode = [...code]

    // Fill inputs with pasted digits
    digits.forEach((digit, index) => {
      if (index < 6) {
        newCode[index] = digit
      }
    })

    setCode(newCode)

    // Focus on the appropriate input after paste
    if (digits.length < 6) {
      inputRefs.current[digits.length]?.focus()
    } else {
      inputRefs.current[5]?.focus()

      // Trigger onComplete if all digits are filled
      if (onComplete) {
        onComplete(newCode.join(""))
      }
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex gap-2 justify-center" onPaste={handlePaste}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Input
            key={index}
            id={`totp-input-${index}`}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            className="w-12 h-12 text-center text-lg font-medium"
            value={code[index]}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            aria-label={`Digit ${index + 1} of verification code`}
          />
        ))}
      </div>
      <p className="sr-only">Enter a 6-digit verification code. Use arrow keys to navigate between inputs.</p>
      <div className="flex flex-col items-end space-y-2">
      <a className="text-white hover:underline cursor-pointer"
        style={{ opacity: 0.75 }}
        onClick={onCancel}
      >
        Cancel
      </a>
      </div>
    </div>
  )
}
