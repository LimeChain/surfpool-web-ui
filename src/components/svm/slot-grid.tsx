'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppConfig } from '@/hooks/use-app-config'

export const SlotsGrid: React.FC = () => {
  const { rpcUrl, wsUrl, loading: configLoading, error: configError } = useAppConfig()
  const [isClient, setIsClient] = useState(false)
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

  
  // WebSocket refs
  const wsRef = useRef<WebSocket | null>(null)
  const subscriptionIdRef = useRef<number | null>(null)
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [wsConnected, setWsConnected] = useState(false)


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

  // Start WebSocket subscription to slot updates
  const startSlotSubscription = useCallback(() => {
    try {
      // Don't create multiple connections
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        console.log('🔗 WebSocket already exists, not creating new connection')
        return
      }
      
      console.log('🔗 Connecting to slot WebSocket:', wsUrl)
      
      // Test if the WebSocket URL is reachable
      let ws: WebSocket
      try {
        ws = new WebSocket(wsUrl)
        wsRef.current = ws
        console.log('🔗 WebSocket created successfully')
      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error)
        return
      }
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log('⏰ Connection timeout, closing WebSocket')
          ws.close()
        }
      }, 10000) // 10 second timeout

      ws.onopen = () => {
        console.log('✅ Slot WebSocket connected')
        clearTimeout(connectionTimeout) // Clear the connection timeout
        setWsConnected(true)
        console.log('🔗 Connection state updated: wsConnected = true')
        
        // Subscribe to slot updates
        const subscribeMessage = {
          jsonrpc: '2.0',
          id: 1,
          method: 'slotSubscribe',
          params: []
        }

        // Wait for WebSocket to be fully ready before subscribing
        let retryCount = 0
        const maxRetries = 10 // Maximum 10 retries (1 second total)
        
        const attemptSubscription = () => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify(subscribeMessage))
              console.log('📤 Sent slot subscription message')
            } catch (error) {
              console.error('❌ Failed to send subscription:', error)
              ws.close()
            }
          } else if (retryCount < maxRetries) {
            retryCount++
            console.log(`⏳ WebSocket not ready yet, readyState: ${ws.readyState}, retry ${retryCount}/${maxRetries}`)
            // Try again in 100ms
            subscriptionTimeoutRef.current = setTimeout(attemptSubscription, 100)
          } else {
            console.error('❌ Failed to subscribe after maximum retries, closing connection')
            ws.close()
          }
        }
        
        // Start attempting subscription after a short delay
        setTimeout(attemptSubscription, 100)
      }

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📡 Slot WebSocket message:', data)
          
          if (data.method === 'slotNotification') {
            // Handle slot notifications
            const slotData = data.params
            console.log('🎯 SLOT UPDATE:', slotData)
            
            if (slotData?.result?.parent && slotData?.result?.root) {
              const newSlot = slotData.result.parent
              console.log('🔄 New slot:', newSlot)
              
              // Calculate slot index within current epoch
              const slotIndexInEpoch = newSlot % slotsInEpoch
              console.log('📊 Slot index in epoch:', slotIndexInEpoch, 'out of', slotsInEpoch)
              
              // Update current slot with epoch-relative index
              setCurrentSlot(slotIndexInEpoch)
              
              // Update animation - move to next circle and add current to trail
              setCurrentRect((prev) => {
                const nextRect = (prev + 1) % totalCircles
                
                // Add the previous circle to trail
                setRedRects((prevRects) => {
                  const nextRects = new Set(prevRects)
                  nextRects.add(prev)
                  
                  // Reset trail if we're at the end
                  if (nextRect === 0) {
                    console.log('🔄 Resetting trail at end of grid')
                    return new Set()
                  }
                  
                  console.log('📊 Added circle', prev, 'to trail. Trail size:', nextRects.size)
                  return nextRects
                })
                
                console.log('🔄 Moving from circle', prev, 'to circle', nextRect)
                return nextRect
              })
            }
          } else if (data.result !== undefined && data.id === 1) {
            // Subscription confirmation
            subscriptionIdRef.current = data.result
            console.log('✅ Slot subscription confirmed with ID:', data.result)
          }
        } catch (err) {
          console.error('❌ Error parsing slot WebSocket message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('❌ Slot WebSocket error:', error)
      }

      ws.onclose = (event: CloseEvent) => {
        console.log('🔌 Slot WebSocket disconnected, code:', event.code, 'reason:', event.reason)
        clearTimeout(connectionTimeout) // Clear the connection timeout
        
        // Clear subscription timeout if it exists
        if (subscriptionTimeoutRef.current) {
          clearTimeout(subscriptionTimeoutRef.current)
          subscriptionTimeoutRef.current = null
        }
        
        setWsConnected(false)
        console.log('🔗 Connection state updated: wsConnected = false')
        
        // Clear the current WebSocket reference
        wsRef.current = null
        
        // Only attempt to reconnect if we're not already trying to connect
        if (!wsRef.current) {
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect...')
            startSlotSubscription()
          }, 5000) // Wait 5 seconds before reconnecting
        }
      }

    } catch (err) {
      console.error('❌ Error starting slot subscription:', err)
    }
  }, [totalCircles, currentRect])

  // Stop WebSocket subscription
  const stopSlotSubscription = useCallback(() => {
    if (wsRef.current) {
      console.log('🔌 Stopping slot subscription')
      
      // Clear subscription timeout if it exists
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current)
        subscriptionTimeoutRef.current = null
      }
      
      // Handle WebSocket cleanup
      if (wsRef.current && subscriptionIdRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Unsubscribe from slots
        const unsubscribeMessage = {
          jsonrpc: '2.0',
          id: 2,
          method: 'slotUnsubscribe',
          params: [subscriptionIdRef.current]
        }
        
        wsRef.current.send(JSON.stringify(unsubscribeMessage))
        wsRef.current.close()
      } else if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      console.log('📏 Container not available for ResizeObserver')
      return
    }

    console.log('📏 Setting up ResizeObserver for container')
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width
        console.log('📏 ResizeObserver detected width:', width)
        setCanvasSize({ width, height: canvasGridHeight })
      }
    })

    observer.observe(container)
    
    // Also set initial size immediately if container has width
    const initialWidth = container.clientWidth
    if (initialWidth > 0) {
      console.log('📏 Setting initial size from container:', initialWidth)
      setCanvasSize({ width: initialWidth, height: canvasGridHeight })
    }
    
    return () => observer.disconnect()
  }, [canvasGridHeight])

  // Draw effect: only draws, does not set up interval
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isClient) {
      console.log('🎨 Canvas draw skipped - canvas:', !!canvas, 'isClient:', isClient)
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('❌ Could not get canvas context')
      return
    }

    const { width, height } = canvasSize
    console.log('🎨 Drawing canvas with size:', { width, height })
    
    if (width === 0 || height === 0) {
      console.log('⚠️ Canvas size is zero, skipping draw')
      return
    }
    
    canvas.width = width
    canvas.height = height
    
    // Enable GPU acceleration
    ctx.imageSmoothingEnabled = false // Disable anti-aliasing for better performance
    ctx.globalCompositeOperation = 'source-over'

    const totalColumns = Math.floor((width - 2 * horizontalPadding + horizontalSpacing) / (circleDiameter + horizontalSpacing))
    const newTotalCircles = totalColumns * totalRows
    console.log('📊 Total circles:', newTotalCircles, 'Columns:', totalColumns, 'Rows:', totalRows)
    setTotalCircles(newTotalCircles)

    ctx.clearRect(0, 0, width, height)
    let circleIndex = 0
    let rowCount = 0

    for (let y = 0; rowCount < totalRows; y += circleDiameter + verticalSpacing) {
      let colCount = 0
      for (let x = horizontalPadding; colCount < totalColumns && x + circleDiameter <= width - horizontalPadding; x += circleDiameter + horizontalSpacing) {
        // Get animation progress for this circle
        const progress = animationProgress.get(circleIndex) || 0
        
        let fillStyle;
        
        // Simple green animation - no WebSocket dependency
        const inactiveColor = hexToRgb(INACTIVE_SLOT_COLOR)
        const activeColor = hexToRgb(ACTIVE_SLOT_COLOR)
        
        if (circleIndex === 0) {
          console.log('🎨 Drawing circle 0 - progress:', progress.toFixed(2), 'isActive:', redRects.has(0) || 0 === currentRect)
        }
        
        if (inactiveColor && activeColor) {
          const r = Math.round(inactiveColor.r + (activeColor.r - inactiveColor.r) * progress)
          const g = Math.round(inactiveColor.g + (activeColor.g - inactiveColor.g) * progress)
          const b = Math.round(inactiveColor.b + (activeColor.b - inactiveColor.b) * progress)
          
          fillStyle = `rgb(${r}, ${g}, ${b})`
        } else {
          fillStyle = progress > 0.5 ? ACTIVE_SLOT_COLOR : INACTIVE_SLOT_COLOR
        }
        
        ctx.fillStyle = fillStyle
        ctx.beginPath()
        ctx.arc(x + circleRadius, y + circleRadius, circleRadius, 0, 2 * Math.PI)
        ctx.fill()
        circleIndex++
        colCount++
      }
      rowCount++
    }
    
    console.log('✅ Canvas drawn with', circleIndex, 'circles')
  }, [canvasSize, currentRect, redRects, animationProgress, circleRadius, isClient])

  // Helper function to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  // Set client flag on mount and initialize canvas size
  useEffect(() => {
    console.log('🚀 Component mounting, setting isClient to true')
    setIsClient(true)
    
    // Initialize animation state after client-side hydration
    setRedRects(new Set([0])) // Start with first dot active
    setAnimationProgress(new Map([[0, 1]])) // Start with first dot fully active
    
    // Set initial canvas size if container is available
    if (containerRef.current) {
      const width = containerRef.current.clientWidth
      console.log('📏 Container width:', width)
      if (width > 0) {
        setCanvasSize({ width, height: canvasGridHeight })
        console.log('📏 Set initial canvas size:', { width, height: canvasGridHeight })
      } else {
        console.log('⚠️ Container width is 0, will wait for resize')
      }
    } else {
      console.log('⚠️ Container ref not available yet')
    }
    
    // Fallback: force canvas size after a delay if still 0
    const fallbackTimer = setTimeout(() => {
      if (canvasSize.width === 0 && containerRef.current) {
        const fallbackWidth = containerRef.current.clientWidth || 800 // Default to 800px if still 0
        console.log('🔄 Fallback: setting canvas width to:', fallbackWidth)
        setCanvasSize({ width: fallbackWidth, height: canvasGridHeight })
      }
    }, 1000) // Wait 1 second
    
    return () => clearTimeout(fallbackTimer)
  }, [canvasGridHeight, canvasSize.width])

  // Fetch epoch data on component mount
  useEffect(() => {
    if (isClient) {
      fetchEpochData()
    }
  }, [isClient])

  // Start animation timer when component mounts
  useEffect(() => {
    if (isClient && totalCircles > 1) {
      console.log('🎬 Starting animation timer')
      
      // Timer-based animation - independent of WebSocket
      const animationTimer = setInterval(() => {
        console.log('🔄 Timer tick - moving dot')
        setCurrentRect((prev) => {
          const nextRect = (prev + 1) % totalCircles
          console.log('🔄 Moving from', prev, 'to', nextRect)
          
          // Add the previous circle to trail
          setRedRects((prevRects) => {
            const nextRects = new Set(prevRects)
            nextRects.add(prev)
            
            // Reset trail if we're at the end
            if (nextRect === 0) {
              console.log('🔄 Resetting trail')
              return new Set()
            }
            
            console.log('🔄 Trail size:', nextRects.size)
            return nextRects
          })
          
          return nextRect
        })
      }, 500) // Move every 500ms
      
      return () => {
        console.log('🛑 Stopping animation timer')
        clearInterval(animationTimer)
      }
    }
  }, [isClient, totalCircles])
  
  // Start WebSocket subscription separately
  useEffect(() => {
    if (isClient && totalCircles > 1) {
      startSlotSubscription()
      
      // Periodic connection check
      const connectionCheck = setInterval(() => {
        if (!wsConnected && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
          console.log('🔍 Connection check: WebSocket is closed, attempting reconnect...')
          startSlotSubscription()
        }
      }, 10000) // Check every 10 seconds to avoid interference
      
      return () => {
        stopSlotSubscription()
        clearInterval(connectionCheck)
      }
    }
  }, [isClient, totalCircles, startSlotSubscription, stopSlotSubscription, wsConnected])

  // Smooth animation effect
  useEffect(() => {
    if (!isClient || totalCircles <= 1) return;
    
    console.log('🎬 Animation effect started - totalCircles:', totalCircles, 'currentRect:', currentRect)
    
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
  }, [isClient, totalCircles, currentRect, redRects])



  // Don't render anything until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="w-full">
        <div className="text-sm font-medium text-zinc-300 uppercase mb-4">SLOTS</div>
        <div className="overflow-hidden" style={{ height: canvasGridHeight, width: '100%' }}>
          <div className="w-full h-full bg-[#2F2F32] rounded"></div>
        </div>
        <div className="text-sm font-medium text-zinc-300 uppercase mt-5 mb-2">EPOCH 0</div>
        <div className="text-xs text-zinc-500 mb-2 text-right -mt-5">0.0%</div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: INACTIVE_SLOT_COLOR }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: '0%', background: ACTIVE_SLOT_COLOR }} />
        </div>
      </div>
    )
  }

  // Show loading state while config is being fetched
  if (configLoading) {
    return (
      <div className="w-full">
        <div className="text-sm font-medium text-zinc-300 uppercase mb-4">SLOTS</div>
        <div className="overflow-hidden" style={{ height: canvasGridHeight, width: '100%' }}>
          <div className="w-full h-full bg-[#2F2F32] rounded flex items-center justify-center">
            <div className="text-sm text-zinc-500">Loading configuration...</div>
          </div>
        </div>
        <div className="text-sm font-medium text-zinc-300 uppercase mt-5 mb-2">EPOCH 0</div>
        <div className="text-xs text-zinc-500 mb-2 text-right -mt-5">0.0%</div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: INACTIVE_SLOT_COLOR }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: '0%', background: ACTIVE_SLOT_COLOR }} />
        </div>
      </div>
    )
  }

  // Show error state if config failed to load
  if (configError) {
    return (
      <div className="w-full">
        <div className="text-sm font-medium text-zinc-300 uppercase mb-4">SLOTS</div>
        <div className="overflow-hidden" style={{ height: canvasGridHeight, width: '100%' }}>
          <div className="w-full h-full bg-[#2F2F32] rounded flex items-center justify-center">
            <div className="text-sm text-red-500">Failed to load configuration</div>
          </div>
        </div>
        <div className="text-sm font-medium text-zinc-300 uppercase mt-5 mb-2">EPOCH 0</div>
        <div className="text-xs text-zinc-500 mb-2 text-right -mt-5">0.0%</div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: INACTIVE_SLOT_COLOR }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: '0%', background: ACTIVE_SLOT_COLOR }} />
        </div>
      </div>
    )
  }

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