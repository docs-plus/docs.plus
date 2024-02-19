class SSE {
  clients = {}

  addClient(eventId, client) {
    // Initialize the client Set if it doesn't exist
    if (!this.clients[eventId]) {
      this.clients[eventId] = new Set()
    }

    // Add the new client
    this.clients[eventId].add(client)

    // Remove the client on 'close' event
    client.res.on('close', () => {
      console.info(`Client disconnected from event ${eventId}`)
      this.clients[eventId].delete(client)
      // Optionally, clean up the event Set if it's empty
      if (this.clients[eventId].size === 0) {
        delete this.clients[eventId]
      }
    })
  }

  send(eventId, data) {
    return new Promise((resolve, reject) => {
      const serializedData = `data: ${JSON.stringify(data)}\n\n`
      const channelId = data.body?.channelId || null
      const userId = data.body?.userId || null

      if (this.clients[eventId]) {
        try {
          this.clients[eventId].forEach((client) => {
            if (userId && client.res.supabaseUserId === userId) {
              client.res.channelId = channelId
            }

            client.res.write(serializedData)
          })
          resolve()
        } catch (error) {
          console.error(`Error sending data to client: ${error}`)
          reject(error)
        }
      } else {
        resolve() // Resolve the promise if there are no clients to send data to
      }
    })
  }
}

export default SSE
