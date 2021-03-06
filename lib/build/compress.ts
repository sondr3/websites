import { createReadStream, createWriteStream } from "fs"
import { EitherAsync } from "purify-ts/EitherAsync"
import stream from "stream/promises"
import { createBrotliCompress, createGzip } from "zlib"

import { Config } from "../site"
import { readdirRecursive } from "../utils"

const INVALID_EXT = [".map", ".txt", ".scss", ".gz", ".br", ""]

export const compress = (config: Config): EitherAsync<Error, void> =>
  EitherAsync(async () => {
    if (config.production) {
      await gzip(config)
      await brotli(config)
    }
  })

/**
 * Compress a directory and all its files with Gzip.
 *
 * @param config - Sitewide configuration
 */
export async function gzip(config: Config): Promise<void> {
  const files = (await readdirRecursive(config.out, INVALID_EXT)).map((file) => {
    const source = createReadStream(file)
    const destination = createWriteStream(`${file}.gz`)
    const gzip = createGzip({ level: 9 })
    return stream.pipeline(source, gzip, destination)
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
    const destination = createWriteStream(`${file}.br`)
    const brotli = createBrotliCompress()

    return stream.pipeline(source, brotli, destination)
  })

  await Promise.allSettled(files)
}
