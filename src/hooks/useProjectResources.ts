"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ProjectResource,
  ResourceType
} from "@/lib/data/types"
import {
  getResourcesForProject,
  uploadResource,
  deleteResource,
  updateResource,
  getResourceStats,
  getResourceBlob,
  getResourceBlobUrl
} from "@/lib/data/resources"

interface UseProjectResourcesReturn {
  resources: ProjectResource[]
  loading: boolean
  error: string | null
  stats: {
    total: number
    byType: Record<ResourceType, number>
    totalSize: number
  }
  refresh: () => void
  upload: (file: File, description?: string) => Promise<ProjectResource>
  remove: (id: string) => Promise<boolean>
  update: (id: string, updates: Partial<ProjectResource>) => ProjectResource | null
  getBlob: (resource: ProjectResource) => Promise<Blob | null>
  getBlobUrl: (resource: ProjectResource) => Promise<string | null>
}

export function useProjectResources(projectId: string): UseProjectResourcesReturn {
  const [resources, setResources] = useState<ProjectResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<{
    total: number
    byType: Record<ResourceType, number>
    totalSize: number
  }>({
    total: 0,
    byType: {
      markdown: 0,
      json: 0,
      csv: 0,
      image: 0,
      audio: 0,
      pdf: 0,
      other: 0
    },
    totalSize: 0
  })

  const loadResources = useCallback(() => {
    setLoading(true)
    setError(null)

    try {
      const projectResources = getResourcesForProject(projectId)
      setResources(projectResources)
      setStats(getResourceStats(projectId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load resources")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadResources()
  }, [loadResources])

  const upload = useCallback(async (file: File, description?: string): Promise<ProjectResource> => {
    const resource = await uploadResource(projectId, file, description)
    loadResources() // Refresh the list
    return resource
  }, [projectId, loadResources])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const success = await deleteResource(id)
    if (success) {
      loadResources() // Refresh the list
    }
    return success
  }, [loadResources])

  const updateRes = useCallback((id: string, updates: Partial<ProjectResource>): ProjectResource | null => {
    const updated = updateResource(id, updates)
    if (updated) {
      loadResources() // Refresh the list
    }
    return updated
  }, [loadResources])

  const getBlob = useCallback(async (resource: ProjectResource): Promise<Blob | null> => {
    if (resource.storage === "indexeddb" && resource.indexedDbKey) {
      return getResourceBlob(resource.indexedDbKey)
    }
    return null
  }, [])

  const getBlobUrl = useCallback(async (resource: ProjectResource): Promise<string | null> => {
    if (resource.storage === "indexeddb" && resource.indexedDbKey) {
      return getResourceBlobUrl(resource.indexedDbKey)
    }
    if (resource.storage === "filepath" && resource.filePath) {
      return resource.filePath
    }
    return null
  }, [])

  return {
    resources,
    loading,
    error,
    stats,
    refresh: loadResources,
    upload,
    remove,
    update: updateRes,
    getBlob,
    getBlobUrl
  }
}
