class SSE {
  clients = {}

  addClient(eventId, client) {
    // Initialize the event array if it doesn't exist
    if (!this.clients[eventId]) {
      this.clients[eventId] = []
    }

    // Add the new client
    this.clients[eventId].push(client)

    // Remove the client on 'close' event
    client.req.on('close', () => {
      console.info(`Client disconnected from event ${eventId}`)
      this.clients[eventId] = this.clients[eventId].filter((c) => c !== client)
      // Optionally, clean up the event array if it's empty
      if (this.clients[eventId].length === 0) {
        delete this.clients[eventId]
      }
    })
  }

  send(eventId, data) {
    if (this.clients[eventId]) {
      this.clients[eventId].forEach((client) =>
        client.res.write(`data: ${JSON.stringify(data)}\n\n`)
      )
    }
  }
}

export default SSE
