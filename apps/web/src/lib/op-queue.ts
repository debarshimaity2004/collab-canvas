'use client'

// Buffers Yjs binary updates in memory when WS is disconnected.
// On reconnect, flush() drains them in order — Yjs deduplicates replayed ops.
export class OpQueue {
  private queue: Uint8Array[] = []

  enqueue(update: Uint8Array) {
    this.queue.push(update)
  }

  flush(): Uint8Array[] {
    const ops = [...this.queue]
    this.queue = []
    return ops
  }

  get size() {
    return this.queue.length
  }
}
