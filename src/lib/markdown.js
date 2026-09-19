import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: false })

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/** Markdown → sanitized HTML. Safe for partially streamed text. */
export function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text || ''), {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr', 'del'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}
