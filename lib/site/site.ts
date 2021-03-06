import path from "path"

import { ContentData } from "../content"
import { logging } from "../logging"
import { Config, defaultConfig } from "./config"
import { initialState, State } from "./state"

const logger = logging.getLogger("site")

export class Site {
  readonly config: Config
  state: State

  constructor(config: Config = defaultConfig, state: State = initialState) {
    this.config = config
    this.state = state
  }

  /**
   * Looks for a CSS file in the site state styles map. Needed because cache busting
   * can turn `style.css` into `style.abcdef123.css`.
   *
   * @param name - File name to look for
   * @returns The correct filename, or undefined if not found
   */
  getStyle = (name: string): string => {
    const stylePath = this.state.styles.get(name)
    return stylePath === undefined ? `/${name}` : `/${path.parse(stylePath).base}`
  }

  getPages = (): IterableIterator<ContentData> => this.state.pages.values()

  addPage = (content: ContentData): void => {
    logger.debug(`Adding page ${content.frontmatter.title} to state`)
    this.state.pages.set(content.metadata.path, { metadata: content.metadata, frontmatter: content.frontmatter })
  }
}
