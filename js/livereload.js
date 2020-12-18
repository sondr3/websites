;(() => {
  const url = "ws://localhost:3001"
  let socket = new WebSocket(url)

  const connect = () => {
    socket = new WebSocket(url)

    socket.onopen = () => {
      console.log(`Socket connected`)
    }

    socket.onmessage = (message) => {
      switch (message.data.trim()) {
        case "reload":
          location.reload()
          break
        case "shutdown":
          socket.close(1000, "Waiting for server to restart")
          setTimeout(connect, 2000)
          break
        default:
          console.error(`Unknown websocket message: ${message}`)
      }
    }

    socket.onclose = (e) => {
      console.log(`Socket closed, attempting to reconnect: ${e.reason}`)
      socket = null

      setTimeout(connect, 2000)
    }

    socket.onerror = (e) => {
      console.error(`Socket error, closing: ${e.message}`)
      socket.close()
    }
  }

  connect()
})()
