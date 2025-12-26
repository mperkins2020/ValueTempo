"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface EventCatalog {
  event_type: string
  description: string
  dimensions: string[]
}

interface MetricCatalog {
  metric_id: string
  label: string
  type: string
}

interface QualitySignalCatalog {
  signal_id: string
  label: string
  source: string
}

interface SegmentCatalog {
  segment_id: string
  label: string
  description: string | null
}

interface Customer {
  customer_id: string
  name: string
  segment_id: string
}

export default function CatalogsPage() {
  const [activeTab, setActiveTab] = useState("events")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  const [events, setEvents] = useState<EventCatalog[]>([])
  const [metrics, setMetrics] = useState<MetricCatalog[]>([])
  const [qualitySignals, setQualitySignals] = useState<QualitySignalCatalog[]>([])
  const [segments, setSegments] = useState<SegmentCatalog[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const [eventsRes, metricsRes, signalsRes, segmentsRes, customersRes] = await Promise.all([
          fetch("/api/catalogs/events"),
          fetch("/api/catalogs/metrics"),
          fetch("/api/catalogs/quality-signals"),
          fetch("/api/catalogs/segments"),
          fetch("/api/catalogs/customers"),
        ])

        if (eventsRes.ok) setEvents(await eventsRes.json())
        if (metricsRes.ok) setMetrics(await metricsRes.json())
        if (signalsRes.ok) setQualitySignals(await signalsRes.json())
        if (segmentsRes.ok) setSegments(await segmentsRes.json())
        if (customersRes.ok) setCustomers(await customersRes.json())
      } catch (error) {
        console.error("Error fetching catalogs:", error)
      }
    }
    fetchData()
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  const filterItems = (items: any[], searchKey: string) => {
    if (!searchQuery) return items
    const query = searchQuery.toLowerCase()
    return items.filter(item => {
      const searchableText = Object.values(item).join(" ").toLowerCase()
      return searchableText.includes(query)
    })
  }

  const getFilteredEvents = () => filterItems(events, "event_type")
  const getFilteredMetrics = () => filterItems(metrics, "metric_id")
  const getFilteredQualitySignals = () => filterItems(qualitySignals, "signal_id")
  const getFilteredSegments = () => filterItems(segments, "segment_id")
  const getFilteredCustomers = () => filterItems(customers, "customer_id")

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Catalogs</h1>
        <p className="text-muted-foreground">Browse and search catalog entries</p>
      </div>

      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search catalogs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="quality-signals">Quality Signals</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <div className="grid gap-4 mt-4">
            {getFilteredEvents().map((event) => (
              <Card key={event.event_type} className="cursor-pointer hover:bg-accent" onClick={() => setSelectedItem(event)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{event.event_type}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(event.event_type)
                      }}
                    >
                      Copy ID
                    </Button>
                  </div>
                  <CardDescription>{event.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <strong>Dimensions:</strong> {event.dimensions.join(", ")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid gap-4 mt-4">
            {getFilteredMetrics().map((metric) => (
              <Card key={metric.metric_id} className="cursor-pointer hover:bg-accent" onClick={() => setSelectedItem(metric)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{metric.label}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(metric.metric_id)
                      }}
                    >
                      Copy ID
                    </Button>
                  </div>
                  <CardDescription>{metric.metric_id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <strong>Type:</strong> {metric.type}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="quality-signals">
          <div className="grid gap-4 mt-4">
            {getFilteredQualitySignals().map((signal) => (
              <Card key={signal.signal_id} className="cursor-pointer hover:bg-accent" onClick={() => setSelectedItem(signal)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{signal.label}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(signal.signal_id)
                      }}
                    >
                      Copy ID
                    </Button>
                  </div>
                  <CardDescription>{signal.signal_id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <strong>Source:</strong> {signal.source}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="segments">
          <div className="grid gap-4 mt-4">
            {getFilteredSegments().map((segment) => (
              <Card key={segment.segment_id} className="cursor-pointer hover:bg-accent" onClick={() => setSelectedItem(segment)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{segment.label}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(segment.segment_id)
                      }}
                    >
                      Copy ID
                    </Button>
                  </div>
                  <CardDescription>{segment.segment_id}</CardDescription>
                </CardHeader>
                <CardContent>
                  {segment.description && (
                    <div className="text-sm">{segment.description}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="customers">
          <div className="grid gap-4 mt-4">
            {getFilteredCustomers().map((customer) => (
              <Card key={customer.customer_id} className="cursor-pointer hover:bg-accent" onClick={() => setSelectedItem(customer)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{customer.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(customer.customer_id)
                      }}
                    >
                      Copy ID
                    </Button>
                  </div>
                  <CardDescription>{customer.customer_id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <strong>Segment:</strong> {customer.segment_id}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {selectedItem && (
        <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Details</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
              ×
            </Button>
          </div>
          <pre className="text-sm bg-muted p-4 rounded overflow-auto">
            {JSON.stringify(selectedItem, null, 2)}
          </pre>
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Referenced in:</h3>
            <p className="text-sm text-muted-foreground">(Deep links coming soon)</p>
          </div>
        </div>
      )}
    </div>
  )
}

