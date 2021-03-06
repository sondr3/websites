import fs from "fs"
import * as http from "http"
import path from "path"
import WebSocket from "ws"

import { renderStyles } from "./assets"
import { buildSite } from "./build"
import { buildPages } from "./content"
import { logging } from "./logging"
import { Site } from "./site"

const logger = logging.getLogger("server")

/**
 * A very simple HTTP server wrapping the builtin Node {@link https://nodejs.org/dist/latest/docs/api/http.html | HTTP server}
 * with a file watcher to automatically reload the website using websockets during development.
 */
export class Server {
  private readonly wss: WebSocket.Server
  private readonly server: http.Server
  private readonly site: Site

  constructor(site: Site) {
    this.site = site
    this.wss = new WebSocket.Server({
      port: 3001,
    })
    this.server = this.buildServer()
  }

  /**
   * Runs the server with both the file watcher and the HTTP server.
   */
  run(): void {
    this.watch()
    this.serve()
  }

  /**
   * Serves the configured output directory on port 3000.
   */
  serve(): void {
    this.server.listen(3000)
    logger.log(`Started server on http://localhost:3000/`)
  }

  /**
   * Closes the websocket and HTTP server.
   */
  close(): void {
    this.server.close()
    this.wss.close()
  }

  /**
   * When Ctrl-C is invoked on the command line, broadcast to clients that server is shutting down.
   */
  broadcastShutdown(): void {
    this.wss.clients.forEach((c) => c.send("shutdown"))
  }

  /**
   * Watch content and assets directories and rebuild required content if needed.
   */
  private watch(): void {
    fs.watch(this.site.config.assets.style, async (type, name) => {
      if (name.endsWith("~")) return
      if (type === "change" || type === "rename") {
        logger.log(`Rendering ${name}`)
        await renderStyles(this.site, path.join(this.site.config.assets.style, "style.scss"))
        this.broadcastReload()
      }
    })

    fs.watch(this.site.config.content.pages, async (type, name) => {
      if (name.endsWith("~")) return
      if (type === "change" || type === "rename") {
        logger.log(`Rendering ${name}`)
        await buildPages(this.site)
        this.broadcastReload()
      }
    })

    fs.watch(path.join(__dirname), async (type, name) => {
      if (name.endsWith("~")) return
      if (type === "change" || type === "rename") {
        logger.log(`Refreshing due to updates in ${name}`)
        await buildSite(this.site)
        this.broadcastReload()
      }
    })
  }

  /**
   * Used when content changes, tells connected websocket clients to reload the webpage.
   */
  private broadcastReload(): void {
    this.wss.clients.forEach((c) => c.send("reload"))
  }

  /**
   * Configures the Node HTTP server.
   */
  private buildServer(): http.Server {
    return http.createServer((request, response) => {
      let filePath = `.${request.url ?? ""}`

      if (filePath === "./") filePath = "./index.html"
      if (filePath.endsWith("/")) filePath += "index.html"

      const extension = String(path.extname(filePath)).toLowerCase()
      const mimetypes = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".ico": "image/x-icon",
        ".png": "image/png",
        ".jpg": "image/jpg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".wav": "audio/wav",
        ".mp4": "video/mp4",
        ".woff": "application/font-woff",
        ".ttf": "application/font-ttf",
        ".eot": "application/vnd.ms-fontobject",
        ".otf": "application/font-otf",
        ".wasm": "application/wasm",
      }

      const contentType = Server.findMimetype(mimetypes, extension) ?? "application/octet-stream"

      fs.readFile(path.join(this.site.config.out, filePath), (error, content) => {
        if (error) {
          if (error.code === "ENOENT") {
            fs.readFile("./404.html", (_error, cont) => {
              response.writeHead(404, { "Content-Type": mimetypes[".html"] })
              response.end(cont, "utf-8")
            })
          } else {
            response.writeHead(500)
            response.end("Something went terribly wrong...")
          }
        } else {
          response.writeHead(200, { "Content-Type": contentType })
          if (contentType === "text/html") {
            const resp = `${content.toString()}\n<script type="text/javascript" src="/js/livereload.js"></script>`
            response.end(resp, "utf-8")
          } else {
            response.end(content, "utf-8")
          }
        }
      })
    })
  }

  /**
   * Try to find a mimetype for a file extension to use in HTTP server.
   *
   * @param mimetypes - Object with known mimetypes
   * @param extension - File extension to look up
   * @returns If extensions is not found, undefined
   */
  private static findMimetype(mimetypes: Record<string, string>, extension: string): string | undefined {
    if (!mimetypes[extension]) return

    return mimetypes[extension]
  }
}
