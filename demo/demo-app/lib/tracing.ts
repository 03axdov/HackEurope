/**
 * Captures the caller's source location from Error.stack and returns it as
 * OTel semantic-convention span attributes (code.filepath, code.lineno, etc.).
 *
 * Usage – call this at the line where you open a span and pass the result as
 * span attributes so the attribute values point to that exact location:
 *
 *   const loc = codeLocation();
 *   tracer.startActiveSpan("my.span", { attributes: loc }, async (span) => { … });
 */
export function codeLocation(depth = 1): Record<string, string | number> {
  const frames = new Error().stack?.split("\n") ?? [];
  // frames[0] = "Error"
  // frames[1] = this function (codeLocation)
  // frames[1 + depth] = the caller we care about
  const frame = frames[1 + depth] ?? "";

  // Handles both:
  //   "    at FunctionName (filepath:line:col)"
  //   "    at filepath:line:col"
  const match = frame.match(/^\s+at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?/);
  if (!match) return {};

  const attrs: Record<string, string | number> = {
    "code.filepath": match[2],
    "code.lineno": parseInt(match[3], 10),
    "code.column": parseInt(match[4], 10),
  };
  if (match[1]) attrs["code.function"] = match[1];
  return attrs;
}
