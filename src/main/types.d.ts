interface ImportMetaEnv {
  readonly MAIN_VITE_GOOGLE_CLIENT_SECRET?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'js-yaml' {
  export function load(str: string, opts?: Record<string, unknown>): unknown
  export function dump(obj: unknown, opts?: Record<string, unknown>): string
  const _default: { load: typeof load; dump: typeof dump }
  export default _default
}

declare module 'html-to-docx' {
  function htmlToDocx(
    html: string,
    headerHtml?: string,
    options?: Record<string, unknown>,
    footerHtml?: string
  ): Promise<Buffer | ArrayBuffer | Blob>
  export default htmlToDocx
}

declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string
    numpages: number
    info: Record<string, unknown>
    metadata: unknown
    version: string
  }
  function pdfParse(dataBuffer: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PdfParseResult>
  export default pdfParse
}
