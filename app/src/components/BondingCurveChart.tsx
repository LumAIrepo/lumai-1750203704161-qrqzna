'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  TooltipItem
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface BondingCurveData {
  supply: number
  price: number
  marketCap: number
}

interface BondingCurveChartProps {
  currentSupply: number
  currentPrice: number
  maxSupply?: number
  className?: string
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  animated?: boolean
}

const BondingCurveChart: React.FC<BondingCurveChartProps> = ({
  currentSupply,
  currentPrice,
  maxSupply = 1000000,
  className = '',
  height = 300,
  showGrid = true,
  showTooltip = true,
  animated = true
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (currentSupply < 0 || currentPrice < 0) {
        throw new Error('Invalid supply or price values')
      }
      setError(null)
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsLoading(false)
    }
  }, [currentSupply, currentPrice])

  const bondingCurveData = useMemo(() => {
    try {
      const data: BondingCurveData[] = []
      const steps = 100
      const stepSize = maxSupply / steps

      for (let i = 0; i <= steps; i++) {
        const supply = i * stepSize
        // Exponential bonding curve: price = base * (supply / maxSupply)^2
        const price = 0.001 * Math.pow(supply / maxSupply, 2) + 0.0001
        const marketCap = supply * price

        data.push({
          supply,
          price,
          marketCap
        })
      }

      return data
    } catch (err) {
      console.error('Error generating bonding curve data:', err)
      return []
    }
  }, [maxSupply])

  const chartData = useMemo(() => {
    if (bondingCurveData.length === 0) return null

    const labels = bondingCurveData.map(point => 
      (point.supply / 1000).toFixed(0) + 'K'
    )

    const priceData = bondingCurveData.map(point => point.price)
    const currentIndex = Math.floor((currentSupply / maxSupply) * bondingCurveData.length)

    return {
      labels,
      datasets: [
        {
          label: 'Price Curve',
          data: priceData,
          borderColor: '#00D4AA',
          backgroundColor: 'rgba(0, 212, 170, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#00D4AA',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2
        },
        {
          label: 'Current Position',
          data: priceData.map((_, index) => 
            index === currentIndex ? currentPrice : null
          ),
          borderColor: '#FF6B6B',
          backgroundColor: '#FF6B6B',
          borderWidth: 0,
          pointRadius: priceData.map((_, index) => 
            index === currentIndex ? 8 : 0
          ),
          pointHoverRadius: 10,
          pointHoverBackgroundColor: '#FF6B6B',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3,
          showLine: false
        }
      ]
    }
  }, [bondingCurveData, currentSupply, currentPrice, maxSupply])

  const chartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: animated ? {
      duration: 1000,
      easing: 'easeInOutQuart'
    } : false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: showTooltip,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#333333',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context: TooltipItem<'line'>[]) => {
            const index = context[0]?.dataIndex
            if (index !== undefined && bondingCurveData[index]) {
              return `Supply: ${(bondingCurveData[index].supply / 1000).toFixed(1)}K`
            }
            return ''
          },
          label: (context: TooltipItem<'line'>) => {
            const index = context.dataIndex
            if (bondingCurveData[index]) {
              const point = bondingCurveData[index]
              return [
                `Price: $${point.price.toFixed(6)}`,
                `Market Cap: $${(point.marketCap / 1000).toFixed(2)}K`
              ]
            }
            return ''
          }
        }
      }
    },
    scales: {
      x: {
        display: showGrid,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: '#888888',
          font: {
            size: 11
          },
          maxTicksLimit: 6
        },
        title: {
          display: true,
          text: 'Supply',
          color: '#888888',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      },
      y: {
        display: showGrid,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: '#888888',
          font: {
            size: 11
          },
          callback: function(value: any) {
            return '$' + Number(value).toFixed(4)
          }
        },
        title: {
          display: true,
          text: 'Price (SOL)',
          color: '#888888',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      }
    }
  }), [showGrid, showTooltip, animated, bondingCurveData])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 rounded-lg ${className}`} style={{ height }}>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-gray-400 text-sm">Loading chart...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 rounded-lg border border-red-500/20 ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-red-400 text-sm">!</span>
          </div>
          <p className="text-red-400 text-sm">Error loading chart</p>
          <p className="text-gray-500 text-xs mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (!chartData) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 rounded-lg ${className}`} style={{ height }}>
        <p className="text-gray-400 text-sm">No data available</p>
      </div>
    )
  }

  return (
    <div className={`bg-gray-900 rounded-lg p-4 border border-gray-800 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg">Bonding Curve</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span className="text-gray-400">Price Curve</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <span className="text-gray-400">Current</span>
          </div>
        </div>
      </div>
      
      <div className="relative" style={{ height }}>
        <Line data={chartData} options={chartOptions} />
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
        <div className="text-center">
          <p className="text-gray-400 text-xs">Current Supply</p>
          <p className="text-white font-semibold">{(currentSupply / 1000).toFixed(1)}K</p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs">Current Price</p>
          <p className="text-green-400 font-semibold">${currentPrice.toFixed(6)}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs">Market Cap</p>
          <p className="text-white font-semibold">${((currentSupply * currentPrice) / 1000).toFixed(2)}K</p>
        </div>
      </div>
    </div>
  )
}

export default BondingCurveChart