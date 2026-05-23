import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useVenueStore = defineStore('venue', () => {
  const zoom = ref(0.7)
  const pan = ref({ x: 60, y: 50 })

  function setZoom(z: number) {
    zoom.value = Math.max(0.25, Math.min(2.5, z))
  }

  function setPan(p: { x: number; y: number }) {
    pan.value = p
  }

  function fitToViewport(vpW: number, vpH: number, venueW: number, venueH: number) {
    const sx = vpW / venueW
    const sy = vpH / venueH
    const z = Math.min(sx, sy) * 0.94
    zoom.value = z
    pan.value = {
      x: (vpW - venueW * z) / 2,
      y: (vpH - venueH * z) / 2,
    }
  }

  return { zoom, pan, setZoom, setPan, fitToViewport }
})
