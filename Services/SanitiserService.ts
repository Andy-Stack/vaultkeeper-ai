export interface ISanitizeOptions {
  replacement?: string;
  separator?: string;
}

export class SanitiserService {
  // Regular expressions for different character classes
  private readonly illegalRe = /[\?<>\\:\*\|"]/g;
  private readonly controlRe = /[\x00-\x1f\x80-\x9f]/g;
  private readonly reservedRe = /^\.+$/;
  private readonly windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  private readonly windowsTrailingRe = /[\. ]+$/;

  constructor() { }

  /**
   * Sanitizes a file path with directories, removing illegal characters and ensuring cross-platform compatibility
   * @param input - The file path to sanitize
   * @param options - Optional configuration for replacement character and output separator
   * @returns Sanitized file path
   */
  public sanitize(input: string, options: ISanitizeOptions = {}): string {
    // Type check
    if (typeof input !== "string") {
      throw new Error("Input must be a string");
    }

    // Normalize empty string to "/" for vault root
    if (input.trim() === "") {
      return "/";
    }

    // Default options
    const replacement = options.replacement || "";
    const outputSeparator = options.separator || "/";

    // Detect if this is an absolute path
    const isAbsolute = input.startsWith("/") || /^[a-zA-Z]:[\\\/]/.test(input);

    // Detect Windows drive letter (e.g., C:)
    const driveMatch = input.match(/^([a-zA-Z]:)[\\\/]/);
    const driveLetter = driveMatch ? driveMatch[1] : "";

    // Split by both forward and back slashes
    // Note: Forward slashes and backslashes are treated as path separators,
    // not as illegal characters within segments. This is intentional for cross-platform compatibility.
    let segments = input.split(/[\\\/]+/);

    // Remove empty segments (from leading/trailing slashes or multiple consecutive slashes)
    // But keep track of whether we started with a slash
    segments = segments.filter((seg, index) => {
      // Keep the first segment even if empty (for absolute paths like /home/...)
      if (index === 0 && seg === "" && isAbsolute && !driveLetter) {
        return true;
      }
      return seg !== "";
    });

    // Sanitize each segment
    const sanitizedSegments = segments.map((segment, index) => {
      // Don"t sanitize the drive letter (first segment if it"s something like "C:")
      if (index === 0 && driveLetter && segment === driveLetter.replace(":", "")) {
        return driveLetter;
      }

      // For the first empty segment of an absolute path, keep it empty
      if (index === 0 && segment === "" && isAbsolute) {
        return "";
      }

      return this.sanitizeSegment(segment, replacement);
    });

    // Rejoin with the desired separator
    let result = sanitizedSegments.join(outputSeparator);

    // For absolute Unix paths, ensure leading slash
    if (isAbsolute && !driveLetter && !result.startsWith(outputSeparator)) {
      result = outputSeparator + result;
    }

    // Truncate the entire path if needed (paths can be up to 4096 bytes on most systems)
    // But for individual filenames, most systems have a 255-byte limit
    // We"ll apply the 255-byte limit to the filename part only
    const lastSeparatorIndex = result.lastIndexOf(outputSeparator);
    if (lastSeparatorIndex !== -1) {
      const directory = result.substring(0, lastSeparatorIndex + 1);
      const filename = result.substring(lastSeparatorIndex + 1);
      const truncatedFilename = this.truncateToByteLength(filename, 255);
      result = directory + truncatedFilename;
    } else {
      // If there"s no separator, the whole thing is a filename
      result = this.truncateToByteLength(result, 255);
    }

    return result;
  }

  /**
   * Sanitizes a single path segment (filename or directory name)
   * @param segment - The path segment to sanitize
   * @param replacement - Character to replace illegal characters with
   * @returns Sanitized segment, or a fallback value if the result would be empty
   */
  private sanitizeSegment(segment: string, replacement: string): string {
    if (!segment || segment === "") {
      return segment;
    }

    let sanitized = segment
      .replace(this.illegalRe, replacement)
      .replace(this.controlRe, replacement)
      .replace(this.reservedRe, replacement)
      .replace(this.windowsReservedRe, replacement)
      .replace(this.windowsTrailingRe, replacement);

    // Handle case where sanitization results in an empty string
    // This can happen with names like "...", "CON", or strings containing only illegal characters
    if (sanitized === "") {
      sanitized = "unnamed";
    }

    return sanitized;
  }

  /**
   * Truncates a string to a maximum byte length while preserving UTF-8 character integrity
   * This method ensures that multi-byte UTF-8 characters are not cut in the middle,
   * which would result in invalid UTF-8 sequences.
   * 
   * @param str - String to truncate
   * @param maxBytes - Maximum byte length
   * @returns Truncated string with valid UTF-8 encoding
   */
  private truncateToByteLength(str: string, maxBytes: number): string {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);

    if (encoded.length <= maxBytes) {
      return str;
    }

    // Truncate at maxBytes, then work backwards to find a valid UTF-8 boundary
    // UTF-8 continuation bytes start with 10xxxxxx (0x80-0xBF)
    let truncateAt = maxBytes;
    while (truncateAt > 0 && (encoded[truncateAt] & 0xC0) === 0x80) {
      truncateAt--;
    }

    // Decode with fatal mode to ensure we get a valid UTF-8 string
    // If decoding fails (which shouldn"t happen with our boundary logic), fall back to safe decode
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
      return decoder.decode(encoded.slice(0, truncateAt));
    } catch {
      // Fallback: use non-fatal mode if something unexpected happens
      const decoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });
      return decoder.decode(encoded.slice(0, truncateAt));
    }
  }
}