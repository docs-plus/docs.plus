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
    const serializedData = `data: ${JSON.stringify(data)}\n\n`
    if (this.clients[eventId]) {
      this.clients[eventId].forEach((client) => {
        try {
          client.res.write(serializedData)
        } catch (error) {
          console.error(`Error sending data to client: ${error}`)
        }
      })
    }
  }
}

export default SSE
