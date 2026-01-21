declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | number[]
    filename?: string
    image?: {
      type?: string
      quality?: number
    }
    html2canvas?: {
      scale?: number
      useCORS?: boolean
      logging?: boolean
      letterRendering?: boolean
    }
    jsPDF?: {
      unit?: string
      format?: string | number[]
      orientation?: "portrait" | "landscape"
    }
    pagebreak?: {
      mode?: string | string[]
      before?: string | string[]
      after?: string | string[]
      avoid?: string | string[]
    }
  }

  interface Html2PdfInstance {
    set(options: Html2PdfOptions): Html2PdfInstance
    from(element: HTMLElement | string): Html2PdfInstance
    save(): Promise<void>
    output(type: string, options?: Record<string, unknown>): Promise<unknown>
    then(callback: (pdf: unknown) => void): Html2PdfInstance
    toPdf(): Html2PdfInstance
    get(type: string): Promise<unknown>
  }

  function html2pdf(): Html2PdfInstance
  function html2pdf(
    element: HTMLElement | string,
    options?: Html2PdfOptions
  ): Html2PdfInstance

  export default html2pdf
}
