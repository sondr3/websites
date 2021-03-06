import { promises as fs } from "fs"
import path from "path"
import { EitherAsync } from "purify-ts/EitherAsync"
import { CustomError } from "ts-custom-error"

import { copyAssets, renderStyles } from "../assets"
import { buildPages } from "../content"
import { sitemap } from "../content/sitemap"
import { logging } from "../logging"
import { Config, Site } from "../site"
import { copyFile, Duration } from "../utils"
import { compress } from "."

const logger = logging.getLogger("build")

export class BuildError extends CustomError {
  public constructor(message: string) {
    super(message)
  }
}

/**
 * Build the whole site by copying assets, building styles and all pages, posts etc.
 *
 * @param site - Configuration to build site with
 */
export const buildSite = (site: Site): EitherAsync<BuildError, void> =>
  EitherAsync(async () => {
    logger.log(`Building site ${site.config.meta.title} (${site.config.url})`)
    const duration = new Duration()

    await EitherAsync.sequence([
      copyAssets(site.config),
      renderStyles(site, path.join(site.config.assets.style, "style.scss")),
      buildPages(site),
      createRootFiles(site.config),
      sitemap(site),
      compress(site.config),
    ])
      .mapLeft((error) => new BuildError(error.message))
      .run()

    duration.end()
    logger.log(`Took ${duration.result()} to build site`)
  })

/**
 * Create assorted files that are often found in the root of webpages, e.g.
 * `robots.txt` and so on.
 */
export const createRootFiles = (config: Config): EitherAsync<BuildError, void> =>
  EitherAsync(async () => {
    await Promise.allSettled(
      [
        "robots.txt",
        "humans.txt",
        "apple-touch-icon.png",
        "favicon.ico",
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "manifest.webmanifest",
      ].map((file) => copyFile(path.join(config.assets.root, file), path.join(config.out, file))),
    )
  })

/**
 * Clean out the build directory.
 */
export const clean = async (config: Config): Promise<void> => {
  await fs.rm(config.out, { recursive: true, force: true })
}
