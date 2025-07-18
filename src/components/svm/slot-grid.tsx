'use client'

import { useEffect, useRef, useState } from 'react'

export const SlotsGrid: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const circleDiameter = 8
  const circleRadius = circleDiameter / 2
  const horizontalSpacing = 6
  const verticalSpacing = 6
  const horizontalPadding = 8
  const verticalPadding = 12
  const totalRows = 5
  const canvasGridHeight = verticalPadding + totalRows * circleDiameter + (totalRows - 1) * verticalSpacing + verticalPadding
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: canvasGridHeight })
  const [currentRect, setCurrentRect] = useState(0)
  // Store totalCircles in state for use in progress bar
  const [totalCircles, setTotalCircles] = useState(1)
  const [redRects, setRedRects] = useState<Set<number>>(new Set())
  const rowHeight = circleDiameter + verticalSpacing
  const DEFAULT_SLOTS_IN_EPOCH = 432_000;

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width
        setCanvasSize({ width, height: canvasGridHeight })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [canvasGridHeight])

  // Draw effect: only draws, does not set up interval
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvasSize
    canvas.width = width
    canvas.height = height

    const totalColumns = Math.floor((width - 2 * horizontalPadding + horizontalSpacing) / (circleDiameter + horizontalSpacing))
    setTotalCircles(totalColumns * totalRows)

    ctx.clearRect(0, 0, width, height)
    let circleIndex = 0
    let rowCount = 0

    for (let y = verticalPadding; rowCount < totalRows; y += circleDiameter + verticalSpacing) {
      let colCount = 0
      for (let x = horizontalPadding; colCount < totalColumns && x + circleDiameter <= width - horizontalPadding; x += circleDiameter + horizontalSpacing) {
        if (redRects.has(circleIndex) || circleIndex === currentRect) {
          ctx.fillStyle = '#62D595'
        } else {
          ctx.fillStyle = '#2F2F32'
        }
        ctx.beginPath()
        ctx.arc(x + circleRadius, y + circleRadius, circleRadius, 0, 2 * Math.PI)
        ctx.fill()
        circleIndex++
        colCount++
      }
      rowCount++
    }
  }, [canvasSize, currentRect, redRects, circleRadius])

  // Animation effect: only sets up interval
  useEffect(() => {
    if (totalCircles <= 1) return;
    const interval = setInterval(() => {
      setRedRects((prev) => {
        // If we're at the last dot, reset the trail
        if (currentRect === totalCircles - 1) {
          return new Set()
        }
        const next = new Set(prev)
        next.add(currentRect)
        return next
      })
      setCurrentRect((prev) => (prev + 1) % totalCircles)
    }, 300)
    return () => clearInterval(interval)
  }, [totalCircles, currentRect])

  return (
    <div ref={containerRef} className="w-full">
      <div className="text-sm font-medium text-zinc-300 uppercase mb-4">SLOTS</div>
      <div className="rounded-2xl overflow-hidden" style={{ height: canvasGridHeight, width: '100%' }}>
        <canvas ref={canvasRef} style={{ background: 'transparent', width: '100%', height: canvasGridHeight }} />
      </div>
      <div className="text-sm font-medium text-zinc-300 uppercase mt-6 mb-4">EPOCH</div>
      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentRect + 1) / totalCircles) * 100}%` }}
        />
      </div>
    </div>
  )
}