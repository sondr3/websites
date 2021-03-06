import crypto from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { EitherAsync } from "purify-ts/EitherAsync"
import { CustomError } from "ts-custom-error"

import { logging } from "../logging"
import { throwELog } from "."

const logger = logging.getLogger("fs")

export class FSError extends CustomError {
  public constructor(message: string) {
    super(message)
  }
}

/**
 * Recursively walk directories finding all files matching the extension.
 *
 * @param directory - Directory to walk
 * @param extension - Extensions to look for
 * @param recurse   - Whether to recursively go into folders
 * @param filepaths - Array of found files
 * @returns An array of all found files
 */
export async function walkDirectory(
  directory: string,
  extension: string,
  recurse = true,
  filepaths: Array<string> = [],
): Promise<Array<string>> {
  const files = await fs.readdir(directory)

  for (const filename of files) {
    const filepath = path.join(directory, filename)
    const stat = await fs.stat(filepath)

    if (stat.isDirectory() && recurse) {
      await walkDirectory(filepath, extension, recurse, filepaths)
    } else if (path.extname(filename) === `.${extension}`) {
      filepaths.push(filepath)
    }
  }

  return filepaths
}

/**
 * A very similar function to {@link walkDirectory}, the major difference being that
 * this lists all files not matching the ignored extensions.
 *
 * @param directory - Directory to find contents of
 * @param ignored_extension - File extensions to ignore, e.g. [".txt"]
 * @param filepaths - Array of found files
 * @returns An array of all found files
 */
export async function readdirRecursive(
  directory: string,
  ignored_extension: Array<string>,
  filepaths: Array<string> = [],
): Promise<Array<string>> {
  const files = await fs.readdir(directory)

  for (const filename of files) {
    const filepath = path.join(directory, filename)
    const stat = await fs.stat(filepath)

    if (stat.isDirectory()) {
      await readdirRecursive(filepath, ignored_extension, filepaths)
    } else if (!ignored_extension.includes(path.extname(filename))) {
      filepaths.push(filepath)
    }
  }

  return filepaths
}

/**
 * Copies all files from a source directory to a destination, optionally recursively
 * copying the subdirectories as well.
 *
 * @param source - Where to copy from
 * @param destination - Where to copy to
 * @param recurse - Whether to recursively copy
 * @returns Error if something went wrong
 */
export const copyFiles = (source: string, destination: string, recurse = true): EitherAsync<FSError, boolean> =>
  EitherAsync(async ({ throwE }) => {
    try {
      const entries = await fs.readdir(source, { withFileTypes: true })
      await createDirectory(destination)

      for (const entry of entries) {
        const source_ = path.join(source, entry.name)
        const destination_ = path.join(destination, entry.name)

        await (entry.isDirectory() && recurse
          ? copyFiles(source_, destination_, recurse)
          : fs.copyFile(source_, destination_, 1))
      }

      return true
    } catch ({ message }) {
      return throwELog({ error: new FSError(message), throwE: throwE, logger: logger })
    }
  })

/**
 * A simple wrapper around {@link fs.copyFile}, mostly for error handling purposes.
 *
 * @param source - File to copy
 * @param destination - Destination to copy to
 * @param overwrite - Overwrite the destination? (true by default)
 * @returns Error if something went wrong
 */
export const copyFile = (source: string, destination: string, overwrite = true): EitherAsync<FSError, boolean> =>
  EitherAsync(async ({ throwE }) => {
    try {
      await fs.copyFile(source, destination, overwrite ? 0 : 1)
      return true
    } catch ({ message }) {
      return throwELog({ error: new FSError(message), throwE: throwE, logger: logger })
    }
  })

/**
 * Create a directory for the file whose path is supplied, recursively creating the directories
 * required.
 *
 * @param filepath - Path to where file wants to go
 * @returns Error if something goes wrong
 */
export const createDirectory = (filepath: string): EitherAsync<FSError, boolean> =>
  EitherAsync(async ({ throwE }) => {
    try {
      await fs.mkdir(filepath, { recursive: true })
      return true
    } catch ({ message }) {
      return throwELog({ error: new FSError(message), throwE: throwE, logger: logger })
    }
  })

/**
 * Writes some content to a file.
 *
 * @param filepath - File to write to
 * @param content - Content to write
 * @returns Error if writing fails
 */
export const writeFile = (filepath: string, content: string | Buffer): EitherAsync<FSError, boolean> =>
  EitherAsync(async ({ throwE }) => {
    try {
      await fs.writeFile(filepath, content)
      return true
    } catch ({ message }) {
      return throwELog({ error: new FSError(message), throwE: throwE, logger: logger })
    }
  })

/**
 * Reads the content of a file.
 *
 * @param filepath - File to read contents of
 * @returns Error if file could not be read
 */
export const readFile = (filepath: string): EitherAsync<FSError, string> =>
  EitherAsync(async ({ throwE }) => {
    try {
      return await fs.readFile(filepath, { encoding: "utf-8" })
    } catch ({ message }) {
      return throwELog({ error: new FSError(message), throwE: throwE, logger: logger })
    }
  })

/**
 * Create a hash of a file, based on its content. The hash is an eight character long
 * MD5 hash used by reading the files contents.
 *
 * @param filepath - File to read and hash
 * @returns The hash of the file
 */
export const createFileHash = (filepath: string): EitherAsync<FSError, string> => {
  return readFile(filepath)
    .map((c) => {
      const md5 = crypto.createHash("md5")
      md5.update(c)
      return md5.digest("hex").slice(0, 8)
    })
    .mapLeft((error) => new FSError(error.message))
}

/**
 * Remove a directory, optionally recursive using Either.
 *
 * @param directoryPath - Path to delete
 * @param recursive - Recursively delete all content
 * @param force - Ignore errors
 */
export const rmdir = (directoryPath: string, recursive = false, force = false): EitherAsync<FSError, boolean> =>
  EitherAsync(({ throwE }) => {
    return fs
      .rm(directoryPath, { recursive, force })
      .then(() => true)
      .catch(({ message }) => throwELog({ error: new FSError(message), throwE, logger }))
  })

/**
 * Wrapper around {@link rmdir} to delete multiple files.
 *
 * @param toDelete- Paths to delete
 * @param recursive - Recursively delete all content
 * @param force - Ignore errors
 */
export const rmdirs = (toDelete: Array<string>, recursive = false, force = false): EitherAsync<FSError, boolean[]> =>
  EitherAsync.sequence(toDelete.map((path_) => rmdir(path_, recursive, force)))
