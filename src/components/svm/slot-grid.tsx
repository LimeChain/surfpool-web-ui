'use client'

import { useEffect, useRef, useState } from 'react'

export const SlotsGrid: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const circleDiameter = 8
  const circleRadius = circleDiameter / 2
  const horizontalSpacing = 6
  const verticalSpacing = 6
  const horizontalPadding = 0
  const verticalPadding = 0
  const totalRows = 5
  const canvasGridHeight = totalRows * circleDiameter + (totalRows - 1) * verticalSpacing
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: canvasGridHeight })
  const [currentRect, setCurrentRect] = useState(0)
  // Store totalCircles in state for use in progress bar
  const [totalCircles, setTotalCircles] = useState(1)
  const [redRects, setRedRects] = useState<Set<number>>(new Set())
  const [animationProgress, setAnimationProgress] = useState<Map<number, number>>(new Map())
  const rowHeight = circleDiameter + verticalSpacing
  const DEFAULT_SLOTS_IN_EPOCH = 432_000;
  const ACTIVE_SLOT_COLOR = '#62D595';
  const INACTIVE_SLOT_COLOR = '#2F2F32';
  const TRANSITION_DURATION = 300; // milliseconds
  
  // Epoch state
  const [currentEpoch, setCurrentEpoch] = useState<number>(0)
  const [currentSlot, setCurrentSlot] = useState<number>(0)
  const [slotsInEpoch, setSlotsInEpoch] = useState<number>(DEFAULT_SLOTS_IN_EPOCH)
  const rpcUrl = 'http://127.0.0.1:8899'

  // Fetch epoch and slot data from RPC
  const fetchEpochData = async () => {
    try {
      // Fetch current epoch info
      const epochResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getEpochInfo',
        }),
      })
      
      if (epochResponse.ok) {
        const epochData = await epochResponse.json()
        if (epochData.result) {
          setCurrentEpoch(epochData.result.epoch)
          setCurrentSlot(epochData.result.slotIndex)
          setSlotsInEpoch(epochData.result.slotsInEpoch)
        }
      }
    } catch (error) {
      console.error('Error fetching epoch data:', error)
    }
  }

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

    for (let y = 0; rowCount < totalRows; y += circleDiameter + verticalSpacing) {
      let colCount = 0
      for (let x = horizontalPadding; colCount < totalColumns && x + circleDiameter <= width - horizontalPadding; x += circleDiameter + horizontalSpacing) {
        // Get animation progress for this circle
        const progress = animationProgress.get(circleIndex) || 0
        
        // Interpolate between inactive and active colors
        const inactiveColor = hexToRgb(INACTIVE_SLOT_COLOR)
        const activeColor = hexToRgb(ACTIVE_SLOT_COLOR)
        
        if (inactiveColor && activeColor) {
          const r = Math.round(inactiveColor.r + (activeColor.r - inactiveColor.r) * progress)
          const g = Math.round(inactiveColor.g + (activeColor.g - inactiveColor.g) * progress)
          const b = Math.round(inactiveColor.b + (activeColor.b - inactiveColor.b) * progress)
          
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        } else {
          ctx.fillStyle = progress > 0.5 ? ACTIVE_SLOT_COLOR : INACTIVE_SLOT_COLOR
        }
        
        ctx.beginPath()
        ctx.arc(x + circleRadius, y + circleRadius, circleRadius, 0, 2 * Math.PI)
        ctx.fill()
        circleIndex++
        colCount++
      }
      rowCount++
    }
  }, [canvasSize, currentRect, redRects, animationProgress, circleRadius])

  // Helper function to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  // Fetch epoch data on component mount and periodically
  useEffect(() => {
    fetchEpochData()
    
    // Fetch epoch data every 5 seconds
    const epochInterval = setInterval(fetchEpochData, 5000)
    
    return () => clearInterval(epochInterval)
  }, [])

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

  // Smooth animation effect
  useEffect(() => {
    if (totalCircles <= 1) return;
    
    const animationInterval = setInterval(() => {
      setAnimationProgress((prev) => {
        const next = new Map(prev)
        
        // Update progress for all circles
        for (let i = 0; i < totalCircles; i++) {
          const isActive = redRects.has(i) || i === currentRect
          const currentProgress = next.get(i) || 0
          
          if (isActive && currentProgress < 1) {
            next.set(i, Math.min(1, currentProgress + 0.1))
          } else if (!isActive && currentProgress > 0) {
            next.set(i, Math.max(0, currentProgress - 0.1))
          }
        }
        
        return next
      })
    }, 50) // Update every 50ms for smooth animation
    
    return () => clearInterval(animationInterval)
  }, [totalCircles, currentRect, redRects])

  return (
    <div ref={containerRef} className="w-full">
      <div className="text-sm font-medium text-zinc-300 uppercase mb-4">SLOTS</div>
      <div className="overflow-hidden" style={{ height: canvasGridHeight, width: '100%' }}>
        <canvas ref={canvasRef} style={{ background: 'transparent', width: '100%', height: canvasGridHeight }} />
      </div>
      <div className="text-sm font-medium text-zinc-300 uppercase mt-5 mb-2">EPOCH {currentEpoch}</div>
      <div className="text-xs text-zinc-500 mb-2 text-right -mt-5">
        {((currentSlot / slotsInEpoch) * 100).toFixed(1)}%
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: INACTIVE_SLOT_COLOR }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${(currentSlot / slotsInEpoch) * 100}%`,
            background: ACTIVE_SLOT_COLOR,
          }}
        />
      </div>
    </div>
  )
}