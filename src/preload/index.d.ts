import type { SolaceApi } from './index'

declare global {
  interface Window {
    solace: SolaceApi
  }
}

export {}
