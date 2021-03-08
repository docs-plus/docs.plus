exports.init = (io, { pid, namespace, preservedNamespace }) => {
  console.info(`Socket[${pid}] with namespace:${namespace} has loaded!`)

  io.on('connection', (socket) => {
    console.info(`Client[${pid}] connected .. user ${socket.id} .. namespace ${namespace}`)

    socket.on('message', (data) => {
      console.log(`msg: ${data}, pid: ${(data, process.pid)}`)
      socket.emit('message', data)
    })

    socket.on('broadCastMessage', (data) => {
      console.log(`msg: ${data}, pid: ${(data, process.pid)}`)
      io.emit('broadCastMessage', 'the game will start soon')
    })
  })
}
