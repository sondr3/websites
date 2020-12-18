import { Config, getConfig } from "../config"
import stream from "stream/promises"
import { createBrotliCompress, createGzip } from "zlib"
import { readdirRecursive } from "../utils"
import { createReadStream, createWriteStream } from "fs"

const INVALID_EXT = [".map", ".txt", ".scss", ".gz", ".br", ""]

export async function compress(prod: boolean): Promise<void> {
  const config = getConfig()
  if (prod) {
    await gzip(config)
    await brotli(config)
  }
}

/**
 * Compress a directory and all its files with Gzip.
 *
 * @param config - Sitewide configuration
 */
export async function gzip(config: Config): Promise<void> {
  const files = (await readdirRecursive(config.out, INVALID_EXT)).map((file) => {
    const source = createReadStream(file)
    const dest = createWriteStream(`${file}.gz`)
    const gzip = createGzip({ level: 9 })
    return stream.pipeline(source, gzip, dest)
  })

  await Promise.allSettled(files)
}

/**
 * Compress a directory and all its files with brotli.
 *
 * @param config - Sitewide configuration
 */
export async function brotli(config: Config): Promise<void> {
  const files = (await readdirRecursive(config.out, INVALID_EXT)).map((file) => {
    const source = createReadStream(file)
    const dest = createWriteStream(`${file}.br`)
    const brotli = createBrotliCompress()

    return stream.pipeline(source, brotli, dest)
  })

  await Promise.allSettled(files)
}