export async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    // Clipboard API needs a secure context; fall back to selecting the text
    const input = document.createElement('textarea')
    input.value = value
    document.body.append(input)
    input.select()
    document.execCommand('copy')
    input.remove()
  }
}
